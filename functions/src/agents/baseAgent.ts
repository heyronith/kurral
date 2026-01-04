import OpenAI from 'openai';
import { logger } from 'firebase-functions';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

let cachedClient: OpenAI | null = null;

const getApiKey = (): string => {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.openaiApiKey ||
    process.env.OPENAI_APIKEY ||
    ''
  );
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
      logger.error('[BaseAgent] OpenAI error', error);
      const message = error?.message || 'Unknown OpenAI error';
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
      logger.error('[BaseAgent] JSON parsing error', error, { rawResponse });
      throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
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
      logger.error('[BaseAgent] JSON parsing error (vision)', error, { rawResponse });
      throw new Error(`Failed to parse AI vision response as JSON: ${error.message}`);
    }
  }

  static isAvailable(): boolean {
    return Boolean(getApiKey());
  }
}

export default BaseAgent;


