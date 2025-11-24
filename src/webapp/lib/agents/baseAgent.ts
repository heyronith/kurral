// Base OpenAI client
import OpenAI from 'openai';

// Get API key from environment variable
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

if (!API_KEY) {
  console.warn('VITE_OPENAI_API_KEY is not set. AI features will not work.');
}

// Initialize OpenAI client
// Note: dangerouslyAllowBrowser is required for browser usage
// In production, consider using a backend proxy for API calls
const openai = API_KEY ? new OpenAI({ 
  apiKey: API_KEY, 
  dangerouslyAllowBrowser: true 
}) : null;

// Default model configuration
// Using gpt-4o-mini for better cost/performance balance
// Alternatives: 'gpt-4o' (more capable), 'gpt-3.5-turbo' (cheaper)
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

export interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: T;
}

export class BaseAgent {
  private modelName: string;

  constructor(modelName: string = DEFAULT_MODEL) {
    if (!openai) {
      throw new Error('OpenAI API key is not configured');
    }
    this.modelName = modelName;
  }

  /**
   * Send a prompt to the OpenAI model
   */
  async generate(prompt: string, systemInstruction?: string): Promise<string> {
    if (!openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      // Add system instruction if provided
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      
      // Add user prompt
      messages.push({ role: 'user', content: prompt });

      console.log('[BaseAgent] Calling OpenAI API with model:', this.modelName);
      
      const response = await openai.chat.completions.create({
        model: this.modelName,
        messages: messages,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: DEFAULT_MAX_TOKENS,
      });

      const text = response.choices[0]?.message?.content || '';
      
      if (!text || text.trim().length === 0) {
        console.error('[BaseAgent] Empty response from OpenAI:', {
          response,
          choices: response.choices,
          finishReason: response.choices[0]?.finish_reason,
        });
        throw new Error('API_RATE_LIMIT: OpenAI returned empty response');
      }

      console.log('[BaseAgent] OpenAI response received, length:', text.length);
      return text.trim();
    } catch (error: any) {
      console.error('[BaseAgent] OpenAI error:', error);
      
      // Check for rate limit errors
      const errorMessage = error?.message || '';
      const errorString = JSON.stringify(error || {});
      const status = error?.status || error?.response?.status || error?.statusCode;
      
      const isRateLimit = 
        errorMessage.includes('429') || 
        errorMessage.includes('rate_limit') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('API_RATE_LIMIT') ||
        errorString.includes('429') ||
        status === 429;

      if (isRateLimit) {
        console.warn('[BaseAgent] Rate limit detected');
        throw new Error('API rate limit exceeded. Please wait a moment and try again.');
      }

      throw new Error(`AI generation failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate JSON response with schema validation
   */
  async generateJSON<T>(
    prompt: string, 
    systemInstruction?: string,
    schema?: any
  ): Promise<T> {
    if (!openai) {
      throw new Error('OpenAI not initialized');
    }

    let rawResponse = '';
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      // Add system instruction if provided
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      
      // Add schema instruction for JSON response
      let jsonPrompt = prompt;
      if (schema) {
        // If schema describes an array, explicitly request an array, not a schema structure
        if (schema.type === 'array') {
          jsonPrompt += '\n\nIMPORTANT: Respond with ONLY a valid JSON array directly (not wrapped in an object or schema structure). Example: [{"key": "value"}, {"key": "value"}]\n' +
                       'Do NOT return a schema structure like {"type": "array", "items": [...]}. Return the array itself: [...]\n' +
                       'No markdown, no code blocks, no explanation, just the raw JSON array.';
        } else {
          jsonPrompt += '\n\nIMPORTANT: Respond with ONLY a valid JSON object matching this exact schema, no other text:\n' + 
                       JSON.stringify(schema, null, 2) +
                       '\n\nReturn ONLY the JSON object, no markdown, no code blocks, no explanation.';
        }
      } else {
        jsonPrompt += '\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code blocks, no explanation, just the raw JSON.';
      }
      
      messages.push({ role: 'user', content: jsonPrompt });

      console.log('[BaseAgent] Calling OpenAI API for JSON with model:', this.modelName);
      
      const response = await openai.chat.completions.create({
        model: this.modelName,
        messages: messages,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: DEFAULT_MAX_TOKENS,
        // Use response_format for structured JSON when schema is provided
        ...(schema ? { response_format: { type: 'json_object' } } : {}),
      });

      rawResponse = response.choices[0]?.message?.content || '';
      
      console.log('[BaseAgent] Raw OpenAI response length:', rawResponse.length);
      console.log('[BaseAgent] Raw OpenAI response:', rawResponse.substring(0, 300));

      if (!rawResponse || rawResponse.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      // Extract JSON from response (handle cases where it's wrapped in markdown)
      let jsonText = rawResponse.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.includes('```json')) {
        const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          jsonText = match[1].trim();
        }
      } else if (jsonText.includes('```')) {
        const match = jsonText.match(/```[^\n]*\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          jsonText = match[1].trim();
        }
      }

      // Remove any leading/trailing whitespace or newlines
      jsonText = jsonText.trim();
      
      // Try to find JSON object if there's extra text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      if (!jsonText || jsonText.length === 0) {
        throw new Error('No JSON found in response');
      }

      console.log('[BaseAgent] Extracted JSON text length:', jsonText.length);
      console.log('[BaseAgent] Extracted JSON text:', jsonText.substring(0, 300));

      // Parse JSON
      const parsed = JSON.parse(jsonText);
      console.log('[BaseAgent] Successfully parsed JSON');
      return parsed as T;
    } catch (error: any) {
      console.error('[BaseAgent] JSON parsing error:', error);
      console.error('[BaseAgent] Raw response that failed:', rawResponse);
      console.error('[BaseAgent] Raw response length:', rawResponse?.length || 0);
      throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
    }
  }

  /**
   * Check if the agent is available
   */
  static isAvailable(): boolean {
    return !!openai && !!API_KEY;
  }
}

export { openai };
export default BaseAgent;
