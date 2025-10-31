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

   
        const actionParamPrompt = `Give me the params which I need to give to the function to run it by understanding the user's message.
USER'S MESSAGE: ${instruction}

-----

FUNCTION NAME: ${actionName}
FUNCTION DESCRIPTION: ${inputSchema.description}
FUNCTION PARAMS: ${JSON.stringify(inputSchema.parameters)}
FUNCTION REQUIRED PARAMS: ${JSON.stringify(inputSchema.required)}

-----

GIVE ME THE RESPONSE IN VALID JSON FORMAT ONLY (no markdown, no backticks) like:
{
    "understand": true,
    "askUser": null,
    "params": {
        "<arg1>": "<value1>",
        "<arg2>": "<value2>"
    }
}

If you need more information from the user, set "understand" to false and put your question in "askUser".
Return ONLY valid JSON, nothing else.`;

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

        const assistantResponsePrompt = `User has already run an action which gave an output in JSON. The output is:
${JSON.stringify(actionResponse)}

USER'S MESSAGE (this has been done): ${instruction}

Now, write a simple, formal, precise, insightful and human-like response (better in paragraph format) to give in return for the user's message, taking help from the output of the action. Try to give useful data. You can use markdown and \\n to format the response. Use underline for links.

YOUR RESPONSE:`;

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