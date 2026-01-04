// BaseAgent for mobile (Expo) - calls OpenAI via secure proxy with Firebase auth
import Constants from 'expo-constants';
import { auth } from '../config/firebase';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

const getProxyEndpoint = (): string => {
  const fromConfig = Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_PROXY_URL;
  if (fromConfig && typeof fromConfig === 'string' && fromConfig.length > 0) {
    return fromConfig;
  }
  const fromEnv = process.env.EXPO_PUBLIC_OPENAI_PROXY_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  throw new Error(
    'OpenAI proxy URL is not configured. Set EXPO_PUBLIC_OPENAI_PROXY_URL in app.config.js or env.'
  );
};

export interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: T;
}

async function callOpenAIProxy(endpoint: string, body: any): Promise<any> {
  const proxyUrl = getProxyEndpoint();
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to use AI features.');
    }
    const idToken = await currentUser.getIdToken();
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        endpoint,
        method: 'POST',
        body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).errorData = errorData;
      throw error;
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error?.message || 'OpenAI proxy call failed');
  }
}

export class BaseAgent {
  private modelName: string;

  constructor(modelName: string = DEFAULT_MODEL) {
    this.modelName = modelName;
  }

  static isAvailable(): boolean {
    try {
      getProxyEndpoint();
      return true;
    } catch {
      return false;
    }
  }

  async generate(prompt: string, systemInstruction?: string): Promise<string> {
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await callOpenAIProxy('/v1/chat/completions', {
      model: this.modelName,
      messages,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
    });

    const text = response.choices?.[0]?.message?.content || '';
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from OpenAI');
    }
    return text.trim();
  }

  async generateJSON<T>(prompt: string, systemInstruction?: string, schema?: any): Promise<T> {
    let jsonPrompt = prompt;
    if (schema) {
      jsonPrompt +=
        '\n\nIMPORTANT: Respond with ONLY valid JSON matching this schema, no extra text:\n' +
        JSON.stringify(schema, null, 2);
    } else {
      jsonPrompt += '\n\nIMPORTANT: Respond with ONLY valid JSON, no extra text.';
    }

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: jsonPrompt });

    const response = await callOpenAIProxy('/v1/chat/completions', {
      model: this.modelName,
      messages,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
    });

    const content = response.choices?.[0]?.message?.content || '';
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error('Failed to parse AI JSON response');
    }
  }
}

