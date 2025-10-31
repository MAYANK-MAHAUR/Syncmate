import { OpenAI } from "openai";

const FIREWORKS_CONFIG = {
  model: "accounts/sentientfoundation/models/dobby-unhinged-llama-3-3-70b-new",
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: process.env.FIREWORKS_API_KEY
};

const SYSTEM_PROMPTS = {
  parameter_extraction: `You are an expert at extracting structured parameters from natural language instructions.

Your task: Parse user instructions and extract EXACT parameter values needed for API calls.

KEY RULES:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. Use exact field names provided in the schema
3. Extract ALL required information from the user's message
4. For GitHub repos: parse "owner/repo" format (e.g., "facebook/react" → owner: "facebook", repo: "react")
5. For emails: extract recipient (to), subject, and message (body)
6. For documents: extract document name (title) and content (text/body)
7. If critical information is missing, set "understand": false and ask for it

ALWAYS return this JSON structure:
{
    "understand": true/false,
    "askUser": "question if understand is false" or null,
    "params": { "field": "value" }
}`,

  friendly_response: `You are a helpful AI assistant providing friendly confirmations to users.

Your task: Convert technical API responses into natural, conversational language.

KEY RULES:
1. Be concise (2-3 sentences maximum)
2. Confirm what action was completed
3. Highlight any important information from the result
4. Use a warm, professional tone
5. Avoid technical jargon unless necessary
6. Don't mention internal IDs, action names, or API details

Focus on what matters to the user.`
};

function getSystemPrompt(taskType = 'default') {
  return SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.friendly_response;
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
      temperature: actualTaskType === 'parameter_extraction' ? 0.3 : 0.7,
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
      const prompt = buildParameterExtractionPrompt(instruction, actionName, schema, attempt > 0);
      const response = await singleMessageLLM('parameter_extraction', prompt);
      
      const parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      
      if (!parsed.params && parsed.understand !== false) {
        throw new Error('No params in response');
      }
      
      return parsed;
      
    } catch (error) {
      console.error(`Parameter extraction attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      if (attempt < maxRetries) {
        console.log('Retrying parameter extraction...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw new Error(`Failed to extract parameters after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

function buildParameterExtractionPrompt(instruction, actionName, schema, isRetry) {
  return `${isRetry ? 'RETRY - Please be more careful with field names and format.\n\n' : ''}Extract parameters from this instruction:

"${instruction}"

For action: ${actionName}
Required fields: ${schema.required.join(', ')}
Available fields: ${Object.keys(schema.parameters).join(', ')}

${isRetry ? '\nREMEMBER: Return ONLY valid JSON with exact field names from the available fields list.\n' : ''}
Return JSON:`;
}

export { getSystemPrompt };