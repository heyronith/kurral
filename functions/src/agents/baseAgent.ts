import OpenAI from 'openai';
import { logger } from 'firebase-functions';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

let cachedClient: OpenAI | null = null;

/**
 * Custom error class for OpenAI API authentication failures
 */
export class OpenAIAuthenticationError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isAuthenticationError: boolean = true;

  constructor(message: string, statusCode: number = 401, code: string = 'invalid_api_key') {
    super(message);
    this.name = 'OpenAIAuthenticationError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, OpenAIAuthenticationError.prototype);
  }
}

/**
 * Custom error class for JSON parsing errors (not authentication)
 */
export class OpenAIJSONParseError extends Error {
  readonly rawResponse: string;
  readonly isJSONParseError: boolean = true;

  constructor(message: string, rawResponse: string = '') {
    super(message);
    this.name = 'OpenAIJSONParseError';
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, OpenAIJSONParseError.prototype);
  }
}

/**
 * Helper function to check if an error is an authentication error
 */
export function isAuthenticationError(error: any): boolean {
  if (error instanceof OpenAIAuthenticationError) {
    return true;
  }
  // Check OpenAI API error structure
  if (error?.status === 401 || error?.code === 'invalid_api_key' || error?.code === 'authentication_error') {
    return true;
  }
  // Check error message patterns
  const message = error?.message || '';
  return (
    message.includes('401') ||
    message.includes('Incorrect API key') ||
    message.includes('invalid_api_key') ||
    message.includes('authentication') ||
    message.includes('Unauthorized')
  );
}

/**
 * Helper function to extract error details from OpenAI errors
 */
function extractErrorDetails(error: any): { message: string; statusCode?: number; code?: string } {
  const statusCode = error?.status || error?.statusCode || error?.response?.status;
  const code = error?.code || error?.error?.code;
  const message = error?.message || error?.error?.message || 'Unknown OpenAI error';

  return { message, statusCode, code };
}

const getApiKey = (): string => {
  const key = process.env.OPENAI_API_KEY || process.env.openaiApiKey || process.env.OPENAI_APIKEY || '';
  if (!key) {
    logger.warn('[BaseAgent] OPENAI_API_KEY not found in environment variables');
    logger.warn('[BaseAgent] Available env vars with "OPENAI":', Object.keys(process.env).filter((k) => k.includes('OPENAI')));
  } else {
    if (!process.env.__OPENAI_KEY_LOGGED) {
      logger.info('[BaseAgent] OPENAI_API_KEY loaded', { length: key.length });
      process.env.__OPENAI_KEY_LOGGED = '1';
    }
  }
  return key;
};

const getClient = (): OpenAI => {
  if (!cachedClient) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured for Cloud Functions');
    }
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
};

export class BaseAgent {
  private modelName: string;

  constructor(modelName: string = DEFAULT_MODEL) {
    this.modelName = modelName;
  }

  private async createChatCompletion(messages: any[], options: Record<string, any> = {}) {
    const client = getClient();
    return client.chat.completions.create({
      model: this.modelName,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
      messages,
      ...options,
    });
  }

  async generate(prompt: string, systemInstruction?: string): Promise<string> {
    const messages: any[] = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      logger.info('[BaseAgent] Calling OpenAI chat completion', { model: this.modelName });
      const response = await this.createChatCompletion(messages);
      const text = response.choices?.[0]?.message?.content || '';
      if (!text.trim()) {
        throw new Error('OpenAI returned empty response');
      }
      return text.trim();
    } catch (error: any) {
      const { message, statusCode, code } = extractErrorDetails(error);
      
      // Check for authentication errors
      if (isAuthenticationError(error)) {
        logger.error('[BaseAgent] OpenAI authentication error - API key is invalid or expired', {
          statusCode,
          code,
          message,
          model: this.modelName,
        });
        throw new OpenAIAuthenticationError(
          `OpenAI API authentication failed: ${message}. Please verify the OPENAI_API_KEY secret is valid.`,
          statusCode || 401,
          code || 'invalid_api_key'
        );
      }
      
      logger.error('[BaseAgent] OpenAI API error', { error, model: this.modelName });
      throw new Error(`AI generation failed: ${message}`);
    }
  }

  async generateJSON<T>(prompt: string, systemInstruction?: string, schema?: any): Promise<T> {
    let rawResponse = '';
    const messages: any[] = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    let jsonPrompt = prompt;
    if (schema) {
      if (schema.type === 'array') {
        jsonPrompt +=
          '\n\nRespond with ONLY a JSON array. No markdown, no code fences, no extra text.';
      } else {
        jsonPrompt +=
          '\n\nRespond with ONLY a JSON object matching this schema. No markdown, no code fences, no extra text.';
      }
    } else {
      jsonPrompt += '\n\nRespond with ONLY a JSON object.';
    }

    messages.push({ role: 'user', content: jsonPrompt });

    try {
      const response = await this.createChatCompletion(messages, {
        response_format: schema ? { type: 'json_object' } : undefined,
      });
      rawResponse = response.choices?.[0]?.message?.content || '';

      if (!rawResponse.trim()) {
        throw new Error('Empty response from AI');
      }

      let jsonText = rawResponse.trim();
      if (jsonText.includes('```json')) {
        const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match?.[1]) jsonText = match[1].trim();
      } else if (jsonText.includes('```')) {
        const match = jsonText.match(/```[^\n]*\s*([\s\S]*?)\s*```/);
        if (match?.[1]) jsonText = match[1].trim();
      }

      const objectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonText = objectMatch[0];
      }

      const parsed = JSON.parse(jsonText);
      return parsed as T;
    } catch (error: any) {
      // Check if this is an authentication error (from the API call, before JSON parsing)
      if (isAuthenticationError(error)) {
        const { message, statusCode, code } = extractErrorDetails(error);
        logger.error('[BaseAgent] OpenAI authentication error - API key is invalid or expired', {
          statusCode,
          code,
          message,
          model: this.modelName,
        });
        throw new OpenAIAuthenticationError(
          `OpenAI API authentication failed: ${message}. Please verify the OPENAI_API_KEY secret is valid.`,
          statusCode || 401,
          code || 'invalid_api_key'
        );
      }
      
      // Check if this is a JSON parsing error (after getting a response)
      if (error instanceof SyntaxError || error.name === 'SyntaxError') {
        logger.error('[BaseAgent] JSON parsing error - failed to parse AI response', {
          error: error.message,
          rawResponse: rawResponse.substring(0, 500), // Log first 500 chars
          model: this.modelName,
        });
        throw new OpenAIJSONParseError(
          `Failed to parse AI response as JSON: ${error.message}`,
          rawResponse
        );
      }
      
      // Other errors (network, timeout, etc.)
      logger.error('[BaseAgent] OpenAI API error', { error, model: this.modelName });
      const { message } = extractErrorDetails(error);
      throw new Error(`OpenAI API error: ${message}`);
    }
  }

  async generateJSONWithVision<T>(
    textPrompt: string,
    imageUrl: string | null,
    systemInstruction?: string,
    schema?: any
  ): Promise<T> {
    let rawResponse = '';
    const messages: any[] = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    let finalPrompt = textPrompt;
    if (schema) {
      finalPrompt += '\n\nRespond with ONLY JSON matching the schema. No markdown.';
    } else {
      finalPrompt += '\n\nRespond with ONLY JSON.';
    }

    const content: any[] = [{ type: 'text', text: finalPrompt }];
    if (imageUrl) {
      content.push({ type: 'image_url', image_url: { url: imageUrl } });
    }

    messages.push({ role: 'user', content });

    try {
      const response = await this.createChatCompletion(messages, {
        response_format: schema ? { type: 'json_object' } : undefined,
      });
      rawResponse = response.choices?.[0]?.message?.content || '';
      if (!rawResponse.trim()) {
        throw new Error('Empty response from AI');
      }

      let jsonText = rawResponse.trim();
      if (jsonText.includes('```json')) {
        const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match?.[1]) jsonText = match[1].trim();
      } else if (jsonText.includes('```')) {
        const match = jsonText.match(/```[^\n]*\s*([\s\S]*?)\s*```/);
        if (match?.[1]) jsonText = match[1].trim();
      }

      const objectMatch = jsonText.match(/\{[\s\S]*\}/) || jsonText.match(/\[[\s\S]*\]/);
      if (objectMatch) {
        jsonText = objectMatch[0];
      }

      const parsed = JSON.parse(jsonText);
      return parsed as T;
    } catch (error: any) {
      // Check if this is an authentication error (from the API call, before JSON parsing)
      if (isAuthenticationError(error)) {
        const { message, statusCode, code } = extractErrorDetails(error);
        logger.error('[BaseAgent] OpenAI authentication error - API key is invalid or expired (vision)', {
          statusCode,
          code,
          message,
          model: this.modelName,
        });
        throw new OpenAIAuthenticationError(
          `OpenAI API authentication failed: ${message}. Please verify the OPENAI_API_KEY secret is valid.`,
          statusCode || 401,
          code || 'invalid_api_key'
        );
      }
      
      // Check if this is a JSON parsing error (after getting a response)
      if (error instanceof SyntaxError || error.name === 'SyntaxError') {
        logger.error('[BaseAgent] JSON parsing error - failed to parse AI vision response', {
          error: error.message,
          rawResponse: rawResponse.substring(0, 500), // Log first 500 chars
          model: this.modelName,
        });
        throw new OpenAIJSONParseError(
          `Failed to parse AI vision response as JSON: ${error.message}`,
          rawResponse
        );
      }
      
      // Other errors (network, timeout, etc.)
      logger.error('[BaseAgent] OpenAI API error (vision)', { error, model: this.modelName });
      const { message } = extractErrorDetails(error);
      throw new Error(`OpenAI API error: ${message}`);
    }
  }

  static isAvailable(): boolean {
    return Boolean(getApiKey());
  }
}

export default BaseAgent;


