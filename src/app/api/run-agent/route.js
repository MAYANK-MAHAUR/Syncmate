import { parseJsonGarbage } from "@/helpers/common";
import { executeAction, getActionViaUseCase, getInputSchema } from "@/utils/agent";
import { extractParameters, singleMessageLLM } from "@/utils/llm";
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

    console.log("=== STEP 1: Getting action ===");
    console.log(`App: ${composioAppName}, Instruction: ${instruction}`);
    
    const actionName = await getActionViaUseCase(composioAppName, instruction);
    if (!actionName) {
      throw new Error(`Could not find appropriate action for: ${instruction}`);
    }
    console.log(`✓ Action found: ${actionName}`);

    console.log("\n=== STEP 2: Getting input schema ===");
    const inputSchema = await getInputSchema(actionName, userId);
    if (!inputSchema) {
      throw new Error(`Could not get input schema for action: ${actionName}`);
    }
    console.log(`✓ Schema loaded. Required fields: ${inputSchema.required.join(', ')}`);

    console.log("\n=== STEP 3: Extracting parameters with LLM ===");
    
    // Use enhanced parameter extraction
    let response;
    try {
      response = await extractParameters(instruction, actionName, inputSchema);
    } catch (extractError) {
      console.error('Parameter extraction failed, trying fallback method...');
      
      // Fallback to original method with enhanced prompt
      const actionParamPrompt = buildEnhancedPrompt(instruction, actionName, inputSchema);
      const paramsResponse = await singleMessageLLM(0, actionParamPrompt);
      console.log('LLM response:', paramsResponse);
      
      response = parseJsonGarbage(paramsResponse);
    }
    
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format from LLM');
    }
    
    if (!response.hasOwnProperty('understand')) {
      response.understand = true;
    }

    console.log(`✓ Parameters extracted. Understand: ${response.understand}`);

    if (!response.understand) {
      const question = response.askUser || "I need more information to complete this task.";
      console.log(`❓ Need more info: ${question}`);
      return question;
    }

    if (!response.params) {
      throw new Error('No parameters provided by LLM');
    }

    console.log('\n=== STEP 4: Executing action ===');
    console.log('Parameters:', JSON.stringify(response.params, null, 2));
    
    const actionResponse = await executeAction(userId, actionName, response.params);
    console.log('✓ Action executed successfully');
    console.log('Response:', JSON.stringify(actionResponse, null, 2));

    console.log('\n=== STEP 5: Generating user-friendly response ===');
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

    const assistantResponse = await singleMessageLLM(1, assistantResponsePrompt);
    console.log('✓ Response generated');
    
    return assistantResponse;

  } catch (error) {
    console.error("\n=== ERROR ===");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
}

function buildEnhancedPrompt(instruction, actionName, inputSchema) {
  // Action-specific hints
  const actionHints = {
    'GMAIL_SEND_EMAIL': `
CRITICAL: Gmail requires EXACT parameter names:
- "recipient_email" (NOT "to", NOT "email")
- "subject" (the email subject line)
- "body" (NOT "message", NOT "content")

Example:
User: "Send email to john@test.com about tomorrow's meeting"
YOU MUST OUTPUT:
{
  "understand": true,
  "askUser": null,
  "params": {
    "recipient_email": "john@test.com",
    "subject": "Tomorrow's Meeting",
    "body": "Hello, I wanted to reach out about our meeting tomorrow."
  }
}`,
    'GMAIL_CREATE_EMAIL_DRAFT': `
CRITICAL: Use these exact field names:
- "recipient_email" (required)
- "subject" (optional)
- "body" (optional)`,
    'GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER': `
Parse repository in format "owner/repo":
- "facebook/react" → owner: "facebook", repo: "react"
- "sentient-agi/ROMA" → owner: "sentient-agi", repo: "ROMA"`,
    'GOOGLEDOCS_CREATE_DOCUMENT': `
Use exact field names:
- "title" (the document name)
- "text" (the document content, NOT "body")`,
  };

  const hint = actionHints[actionName] || '';

  return `You are a parameter extraction expert. Extract parameters from the user's message.

${hint}

USER'S MESSAGE: "${instruction}"

ACTION: ${actionName}
DESCRIPTION: ${inputSchema.description}
REQUIRED PARAMETERS: ${JSON.stringify(inputSchema.required)}
ALL PARAMETERS: ${JSON.stringify(Object.keys(inputSchema.parameters))}
SCHEMA: ${JSON.stringify(inputSchema.parameters, null, 2)}

INSTRUCTIONS:
1. Use EXACT parameter names from "ALL PARAMETERS" above
2. Extract information intelligently from user's natural language
3. For emails: extract recipient address, infer subject if not explicit, create friendly body
4. For GitHub: parse "owner/repo" format
5. If missing REQUIRED info, set understand=false and ask for it

OUTPUT FORMAT (VALID JSON ONLY, NO MARKDOWN):
{
    "understand": true,
    "askUser": null,
    "params": {
        "param_name": "extracted_value"
    }
}

RESPONSE:`;
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  console.log("\n========================================");
  console.log("NEW REQUEST TO /api/run-agent");
  console.log("========================================");
  
  try {
    let body;
    try {
      const text = await request.text();
      console.log('Raw request body length:', text?.length || 0);
      
      if (!text) {
        throw new Error('Empty request body');
      }
      
      body = JSON.parse(text);
      console.log('✓ Request body parsed successfully');
    } catch (parseError) {
      console.error('Body parsing error:', parseError);
      return NextResponse.json({
        response: "Invalid request format. Please ensure you're sending valid JSON.",
        success: false,
        error: parseError.message
      }, { status: 400 });
    }

    const { instruction, app, entityId } = body;

    console.log('Request details:', {
      instruction: instruction?.substring(0, 50) + '...',
      app,
      entityId,
      allKeys: Object.keys(body)
    });

    // Detailed validation
    if (!instruction || typeof instruction !== 'string' || instruction.trim() === '') {
      return NextResponse.json({
        response: "Missing or invalid 'instruction' parameter.",
        success: false,
        receivedKeys: Object.keys(body)
      }, { status: 400 });
    }

    if (!app || typeof app !== 'string' || app.trim() === '') {
      return NextResponse.json({
        response: "Missing or invalid 'app' parameter.",
        success: false,
        receivedKeys: Object.keys(body)
      }, { status: 400 });
    }

    if (!entityId || typeof entityId !== 'string' || entityId.trim() === '') {
      return NextResponse.json({
        response: "Missing or invalid 'entityId' parameter.",
        success: false,
        receivedKeys: Object.keys(body)
      }, { status: 400 });
    }

    const composioAppName = APP_NAME_MAP[app.toLowerCase()] || app.toUpperCase();

    console.log(`\nChecking connection for user: ${entityId}, app: ${app}`);
    const isConnected = await checkUserConnection(entityId, app);
    
    if (!isConnected) {
      console.warn(`❌ User not connected to ${app}`);
      return NextResponse.json({
        response: `You have not connected the ${composioAppName} app. Please connect it first using the settings modal.`,
        success: false
      }, { status: 200 });
    }
    console.log(`✓ User connected to ${app}`);

    console.log('\n>>> Running agent...');
    const response = await runAgent(instruction, app, entityId);

    console.log('\n✓✓✓ SUCCESS ✓✓✓');
    console.log('Response:', response.substring(0, 100) + '...');
    
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
    console.error("\n❌❌❌ ERROR ❌❌❌");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    
    let errorMessage = "Something went wrong. ";
    
    if (error.message.includes('API key')) {
      errorMessage += "Invalid API key configuration.";
    } else if (error.message.includes('parse') || error.message.includes('JSON')) {
      errorMessage += "Failed to process the request. Please try rephrasing.";
    } else if (error.message.includes('recipient_email') || error.message.includes('Missing required')) {
      errorMessage += error.message; // Already descriptive
    } else if (error.message.includes('Could not find appropriate action')) {
      errorMessage += "I couldn't determine which action to perform. Please be more specific.";
    } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      errorMessage += "Authentication error. Please reconnect your account.";
    } else {
      errorMessage += error.message || "Please try again.";
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