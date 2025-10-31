import { OpenAI } from "openai";

// Fireworks AI configuration
const FIREWORKS_CONFIG = {
  model: "accounts/sentientfoundation/models/dobby-unhinged-llama-3-3-70b-new",
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: process.env.FIREWORKS_API_KEY
};

export async function chatLLM(messages) {
  if (!FIREWORKS_CONFIG.apiKey) {
    throw new Error('FIREWORKS_API_KEY is not configured in environment variables');
  }

  const openai_client = new OpenAI({
    apiKey: FIREWORKS_CONFIG.apiKey,
    baseURL: FIREWORKS_CONFIG.baseURL,
  });

  try {
    const response = await openai_client.chat.completions.create({
      model: FIREWORKS_CONFIG.model,
      messages: messages,
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

export async function singleMessageLLM(modelIndex = 0, prompt) {
  if (!FIREWORKS_CONFIG.apiKey) {
    throw new Error('FIREWORKS_API_KEY is not configured in environment variables');
  }

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }

  const openai_client = new OpenAI({
    apiKey: FIREWORKS_CONFIG.apiKey,
    baseURL: FIREWORKS_CONFIG.baseURL,
  });

  try {
    const response = await openai_client.chat.completions.create({
      model: FIREWORKS_CONFIG.model,
      messages: [
        { 
          role: "system", 
          content: "You are an expert software developer agent. Always provide clear, precise responses. When asked for JSON, return ONLY valid JSON with no markdown formatting or extra text." 
        },
        { role: "user", content: prompt }
      ],
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