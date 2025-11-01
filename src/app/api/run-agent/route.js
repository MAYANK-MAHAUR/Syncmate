import { parseJsonGarbage } from "@/helpers/common";
import { executeAction, getActionViaUseCase, getInputSchema } from "@/utils/agent";
import { singleMessageLLM } from "@/utils/llm";
import { Composio } from "composio-core";
import { NextResponse } from "next/server";

const APP_NAME_MAP = {
  github: "GITHUB",
  gmail: "GMAIL",
  youtube: "YOUTUBE",
  googledocs: "GOOGLEDOCS",
  googlecalendar: "GOOGLECALENDAR",
};

async function runAgent(instruction, app, userId) {
  try {
    const composioAppName = APP_NAME_MAP[app.toLowerCase()] || app.toUpperCase();

    console.log("Getting action for:", composioAppName, instruction);
    const actionName = await getActionViaUseCase(composioAppName, instruction);

    if (!actionName) {
      throw new Error(`Could not find appropriate action for: ${instruction}`);
    }

    console.log("Action found:", actionName);
    const inputSchema = await getInputSchema(actionName, userId);

    if (!inputSchema) {
      throw new Error(`Could not get input schema for action: ${actionName}`);
    }

    const actionParamPrompt = `You are a parameter extraction expert. Extract the necessary parameters from the user's message to call the specified function.

USER'S MESSAGE: ${instruction}

FUNCTION DETAILS:
- Name: ${actionName}
- Description: ${inputSchema.description}
- Parameters: ${JSON.stringify(inputSchema.parameters, null, 2)}
- Required Parameters: ${JSON.stringify(inputSchema.required)}

IMPORTANT INSTRUCTIONS FOR EMAIL:
1. For recipient email: use the field name from the schema EXACTLY (it might be "recipient_email", "to", or "email")
2. For email body/content: use "message_body", "body", or "text" based on schema
3. Extract the actual email address (e.g., "test@example.com")
4. Subject should be clear and concise
5. Body/message should be friendly and complete

GENERAL INSTRUCTIONS:
1. Carefully read the user's intent
2. Match intent to function parameters precisely
3. If information is missing, ask the user clearly
4. Use EXACT parameter names from the schema

OUTPUT FORMAT (VALID JSON ONLY, NO MARKDOWN):
{
    "understand": true,
    "askUser": null,
    "params": {
        "param1": "value1",
        "param2": "value2"
    }
}

If you need more information, set "understand" to false and put your question in "askUser".

RESPONSE:`;

    console.log('Calling LLM for params...');
    const paramsResponse = await singleMessageLLM(0, actionParamPrompt);
    console.log('LLM params response:', paramsResponse);
    
    let response;
    try {
      response = parseJsonGarbage(paramsResponse);
      
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format from LLM');
      }
      
      if (!response.hasOwnProperty('understand')) {
        response.understand = true;
      }
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', paramsResponse);
      throw new Error(`Failed to parse LLM response: ${parseError.message}`);
    }

    if (!response.understand) {
      return response.askUser || "I need more information to complete this task.";
    }

    if (!response.params) {
      throw new Error('No parameters provided by LLM');
    }

    console.log('Executing action with params:', response.params);
    const actionResponse = await executeAction(userId, actionName, response.params);
    console.log('Action response:', actionResponse);

    const assistantResponsePrompt = `The user requested an action and it has been completed. Generate a friendly, concise response.

USER'S REQUEST: ${instruction}
ACTION TAKEN: ${actionName}
RESULT: ${JSON.stringify(actionResponse)}

Generate a clear, helpful response that:
1. Confirms what was done
2. Highlights key information from the result
3. Uses a friendly, professional tone
4. Keeps it brief (2-3 sentences max)

RESPONSE:`;

    console.log('Getting assistant response...');
    const assistantResponse = await singleMessageLLM(0, assistantResponsePrompt);
    return assistantResponse;

  } catch (error) {
    console.error("Run agent error details:", error);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

async function checkUserConnection(userId, app) {
  const composio = new Composio({
    apiKey: process.env.COMPOSIO_API_KEY
  });

  try {
    const connectedAccounts = await composio.connectedAccounts.list({
      user_uuid: userId
    });

    const connection = connectedAccounts.items?.find(
      account => account.appName?.toLowerCase() === app.toLowerCase() && 
                account.status === 'ACTIVE'
    );

    return !!connection;
  } catch (error) {
    console.error("Error checking user connection:", error);
    return false;
  }
}

// CRITICAL FIX: Add runtime config for body parsing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // CRITICAL FIX 1: More robust body parsing with error handling
    let body;
    try {
      const text = await request.text();
      console.log('Raw request body:', text);
      
      if (!text) {
        throw new Error('Empty request body');
      }
      
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('Body parsing error:', parseError);
      return NextResponse.json({
        response: "Invalid request format. Please ensure you're sending valid JSON.",
        success: false,
        error: parseError.message
      }, { status: 400 });
    }

    const { instruction, app, entityId } = body;

    console.log('Parsed request:', { instruction, app, entityId, bodyKeys: Object.keys(body) });

    // CRITICAL FIX 2: More detailed validation
    if (!instruction) {
      return NextResponse.json({
        response: "Missing 'instruction' parameter in request body.",
        success: false,
        receivedKeys: Object.keys(body)
      }, { status: 400 });
    }

    if (!app) {
      return NextResponse.json({
        response: "Missing 'app' parameter in request body.",
        success: false,
        receivedKeys: Object.keys(body)
      }, { status: 400 });
    }

    if (!entityId) {
      return NextResponse.json({
        response: "Missing 'entityId' parameter in request body.",
        success: false,
        receivedKeys: Object.keys(body)
      }, { status: 400 });
    }

    // Validate types
    if (typeof instruction !== 'string' || instruction.trim() === '') {
      return NextResponse.json({
        response: "The 'instruction' must be a non-empty string.",
        success: false
      }, { status: 400 });
    }

    if (typeof app !== 'string' || app.trim() === '') {
      return NextResponse.json({
        response: "The 'app' must be a non-empty string.",
        success: false
      }, { status: 400 });
    }

    if (typeof entityId !== 'string' || entityId.trim() === '') {
      return NextResponse.json({
        response: "The 'entityId' must be a non-empty string.",
        success: false
      }, { status: 400 });
    }

    const composioAppName = APP_NAME_MAP[app.toLowerCase()] || app.toUpperCase();

    console.log('Checking connection for:', entityId, app);
    const isConnected = await checkUserConnection(entityId, app);
    
    if (!isConnected) {
      return NextResponse.json({
        response: `You have not connected the ${composioAppName} app. Please connect it first using the settings modal.`,
        success: false
      }, { status: 200 });
    }

    console.log('Running agent...');
    const response = await runAgent(instruction, app, entityId);

    return NextResponse.json({
      response: response,
      success: true
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error("Run agent API error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    let errorMessage = "Something went wrong. ";
    
    if (error.message.includes('API key')) {
      errorMessage += "Invalid API key configuration.";
    } else if (error.message.includes('parse')) {
      errorMessage += "Failed to parse AI response. Please try rephrasing your request.";
    } else if (error.message.includes('action')) {
      errorMessage += "Failed to execute the action. Please check your app connection.";
    } else if (error.message.includes('schema')) {
      errorMessage += "Failed to get action details. Please try again.";
    } else if (error.message.includes('Could not find appropriate action')) {
      errorMessage += "I couldn't determine which action to perform. Please be more specific.";
    } else if (error.message.includes('missing')) {
      errorMessage += "Missing required information. " + error.message;
    } else {
      errorMessage += error.message || "Please try again or contact support.";
    }
    
    return NextResponse.json({
      response: errorMessage,
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
}

// CRITICAL FIX 3: Add OPTIONS handler for CORS
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}