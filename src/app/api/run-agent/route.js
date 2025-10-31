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

    // Enhanced prompt with better instructions
    const actionParamPrompt = `You are a parameter extraction expert. Extract the necessary parameters from the user's message to call the specified function.

USER'S MESSAGE: ${instruction}

FUNCTION DETAILS:
- Name: ${actionName}
- Description: ${inputSchema.description}
- Parameters: ${JSON.stringify(inputSchema.parameters, null, 2)}
- Required Parameters: ${JSON.stringify(inputSchema.required)}

IMPORTANT INSTRUCTIONS:
1. Carefully read the user's intent from their message
2. Match the intent to the function parameters precisely
3. For email/messaging: extract recipient, subject, and body/content
4. For documents: use "text" field for content (NOT "body" or "content")
5. If information is missing, ask the user clearly

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

    // Generate user-friendly response
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

export async function POST(request) {
  try {
    const body = await request.json();
    const { instruction, app, entityId } = body;

    console.log('Received request:', { instruction, app, entityId });

    if (!instruction || !app || !entityId) {
      return NextResponse.json({
        response: "Missing required parameters: instruction, app, or entityId.",
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
    }, { status: 200 });

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
      errorMessage += "Failed to parse AI response.";
    } else if (error.message.includes('action')) {
      errorMessage += "Failed to execute the action.";
    } else if (error.message.includes('schema')) {
      errorMessage += "Failed to get action schema.";
    } else if (error.message.includes('Could not find appropriate action')) {
      errorMessage += "I couldn't understand which action to perform. Please be more specific.";
    } else {
      errorMessage += error.message || "Please try again or contact support.";
    }
    
    return NextResponse.json({
      response: errorMessage,
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}