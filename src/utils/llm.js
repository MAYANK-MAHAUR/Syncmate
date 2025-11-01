import { OpenAI } from "openai";

const FIREWORKS_CONFIG = {
  model: "accounts/sentientfoundation/models/dobby-unhinged-llama-3-3-70b-new",
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: process.env.FIREWORKS_API_KEY
};

// Action-specific extraction rules
const ACTION_EXTRACTION_RULES = {
  "GMAIL_SEND_EMAIL": `
CRITICAL - EXACT PARAMETER NAMES FOR GMAIL:
- "recipient_email" (NOT "to", NOT "email", NOT "recipient")
- "subject" (for the email subject line)
- "body" (NOT "message", NOT "content", NOT "text")

Example extraction:
User: "Send email to john@example.com about meeting tomorrow"
Correct output:
{
  "understand": true,
  "askUser": null,
  "params": {
    "recipient_email": "john@example.com",
    "subject": "Meeting Tomorrow",
    "body": "Hello, I wanted to reach out about our meeting tomorrow."
  }
}`,

  "GMAIL_CREATE_EMAIL_DRAFT": `
CRITICAL - EXACT PARAMETER NAMES FOR GMAIL DRAFT:
- "recipient_email" (required - NOT "to", NOT "email")
- "subject" (optional - the email subject)
- "body" (optional - NOT "message", NOT "content")

If creating a draft without recipient, you MUST ask the user for the recipient email.`,

  "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER": `
CRITICAL - EXACT PARAMETER NAMES FOR GITHUB STAR:
- "owner" (the GitHub username/org that owns the repo)
- "repo" (the repository name)

Example extraction:
User: "Star facebook/react repository"
Parse as: owner="facebook", repo="react"

User: "Star the sentient-agi/ROMA repository"
Parse as: owner="sentient-agi", repo="ROMA"`,

  "GOOGLEDOCS_CREATE_DOCUMENT": `
CRITICAL - EXACT PARAMETER NAMES FOR GOOGLE DOCS:
- "title" (required - the document name)
- "text" (optional - NOT "body", NOT "content")

Example:
User: "Create a doc called Meeting Notes and write Hello World"
{
  "params": {
    "title": "Meeting Notes",
    "text": "Hello World"
  }
}`,

  "GOOGLECALENDAR_CREATE_EVENT": `
CRITICAL - EXACT PARAMETER NAMES FOR CALENDAR:
- "summary" (required - NOT "title")
- "start_datetime" (required - ISO format)
- "end_datetime" (required - ISO format)
- "description" (optional - NOT "body")
- "attendees" (optional - array of email addresses)`,

  "YOUTUBE_SEARCH_YOUTUBE": `
CRITICAL - EXACT PARAMETER NAMES FOR YOUTUBE SEARCH:
- "query" (required - NOT "search", NOT "q")
- "max_results" (optional - number, default 10)

Example:
User: "Search for GaiaNet on YouTube"
{
  "params": {
    "query": "GaiaNet",
    "max_results": 10
  }
}`
};

const SYSTEM_PROMPTS = {
  parameter_extraction: `You are a parameter extraction expert for API actions.

YOUR CRITICAL TASK:
1. Extract parameters using EXACT field names from the schema
2. NEVER invent field names - only use what's in the schema
3. Parse natural language into structured data

FIELD NAME RULES:
- Gmail uses: recipient_email, subject, body
- GitHub uses: owner, repo, title
- Google Docs uses: title, text
- Calendar uses: summary, start_datetime, end_datetime
- YouTube uses: query

ALWAYS return valid JSON (no markdown, no code blocks):
{
    "understand": true/false,
    "askUser": "question if needed" or null,
    "params": { "exact_field_name": "value" }
}

If you're missing REQUIRED information, set understand=false and ask for it.`,

  friendly_response: `You are a helpful AI assistant providing friendly confirmations.

Generate natural, conversational responses (2-3 sentences max) that:
1. Confirm what action was completed
2. Highlight important info from the result
3. Use a warm, professional tone
4. Avoid technical jargon

Example:
Result: {"successfull": true, "data": {"id": "abc123"}}
Good response: "I've successfully sent your email! The message has been delivered."
Bad response: "Action GMAIL_SEND_EMAIL executed with ID abc123 and status successful."`
};

function getSystemPrompt(taskType = 'default') {
  return SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.friendly_response;
}

function buildParameterExtractionPrompt(instruction, actionName, schema) {
  const actionRules = ACTION_EXTRACTION_RULES[actionName] || '';
  
  return `${actionRules}

USER'S REQUEST: "${instruction}"

ACTION: ${actionName}
REQUIRED FIELDS: ${schema.required?.join(', ') || 'none'}
AVAILABLE FIELDS: ${Object.keys(schema.parameters || {}).join(', ')}

SCHEMA DETAILS:
${JSON.stringify(schema.parameters, null, 2)}

EXTRACTION RULES:
1. Use EXACT field names from "AVAILABLE FIELDS" above
2. Extract email addresses, dates, names, and content from user's request
3. For Gmail: recipient_email, subject, body
4. For GitHub repos: parse "owner/repo" format (e.g., "facebook/react")
5. Be smart about inferring context (e.g., "send email about meeting" → subject: "Meeting")
6. If missing REQUIRED fields, set understand=false and ask for them

Return ONLY valid JSON:
{
    "understand": true,
    "askUser": null,
    "params": {
        "recipient_email": "[email protected]",
        "subject": "Subject here",
        "body": "Message content here"
    }
}`;
}

export async function chatLLM(messages, taskType = 'default') {
  if (!FIREWORKS_CONFIG.apiKey) {
    throw new Error('FIREWORKS_API_KEY is not configured in environment variables');
  }

  const openai_client = new OpenAI({
    apiKey: FIREWORKS_CONFIG.apiKey,
    baseURL: FIREWORKS_CONFIG.baseURL,
  });

  try {
    const messagesWithSystem = messages[0]?.role === 'system' 
      ? messages 
      : [{ role: 'system', content: getSystemPrompt(taskType) }, ...messages];

    const response = await openai_client.chat.completions.create({
      model: FIREWORKS_CONFIG.model,
      messages: messagesWithSystem,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;

    if (!content) {
      throw new Error('No content in LLM response');
    }

    if (finishReason !== "stop" && finishReason !== "length") {
      console.warn(`Unexpected finish reason: ${finishReason}`);
    }

    return content;
  } catch (error) {
    console.error('LLM API error:', error);
    throw new Error(`LLM API failed: ${error.message}`);
  }
}

export async function singleMessageLLM(taskType = 0, prompt) {
  if (!FIREWORKS_CONFIG.apiKey) {
    throw new Error('FIREWORKS_API_KEY is not configured in environment variables');
  }

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }

  const taskTypeMap = {
    0: 'parameter_extraction',
    1: 'friendly_response'
  };
  
  const actualTaskType = typeof taskType === 'number' 
    ? taskTypeMap[taskType] || 'default'
    : taskType;

  const openai_client = new OpenAI({
    apiKey: FIREWORKS_CONFIG.apiKey,
    baseURL: FIREWORKS_CONFIG.baseURL,
  });

  try {
    const response = await openai_client.chat.completions.create({
      model: FIREWORKS_CONFIG.model,
      messages: [
        { role: "system", content: getSystemPrompt(actualTaskType) },
        { role: "user", content: prompt }
      ],
      temperature: actualTaskType === 'parameter_extraction' ? 0.2 : 0.7, // Lower temp for extraction
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;

    if (!content) {
      throw new Error('No content in LLM response');
    }

    if (finishReason !== "stop" && finishReason !== "length") {
      console.warn(`Unexpected finish reason: ${finishReason}`);
    }

    return content;
  } catch (error) {
    console.error('LLM API error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code
    });
    
    if (error.status === 401) {
      throw new Error('Invalid Fireworks API key');
    } else if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (error.status >= 500) {
      throw new Error('Fireworks AI service is temporarily unavailable');
    }
    
    throw new Error(`LLM API failed: ${error.message}`);
  }
}

export async function extractParameters(instruction, actionName, schema, maxRetries = 2) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt = buildParameterExtractionPrompt(instruction, actionName, schema);
      console.log(`Attempt ${attempt + 1}: Extracting parameters...`);
      
      const response = await singleMessageLLM('parameter_extraction', prompt);
      
      // Clean response
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (!parsed.params && parsed.understand !== false) {
        throw new Error('LLM returned no params');
      }
      
      console.log('✓ Parameters extracted successfully');
      return parsed;
      
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      if (attempt < maxRetries) {
        console.log('Retrying with more explicit instructions...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw new Error(`Failed to extract parameters after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

export { getSystemPrompt, buildParameterExtractionPrompt };