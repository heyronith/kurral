/**
 * BaseAgent - Secure OpenAI Client
 * 
 * This agent now uses a serverless proxy (/api/openai-proxy) instead of
 * calling OpenAI directly from the browser. This keeps the API key secure
 * on the server and never exposes it to the client.
 */

// Default model configuration
// Using gpt-4o-mini for better cost/performance balance
// Alternatives: 'gpt-4o' (more capable), 'gpt-3.5-turbo' (cheaper)
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

// Proxy endpoint (serverless function)
const PROXY_ENDPOINT = '/api/openai-proxy';

export interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: T;
}

/**
 * Call OpenAI API through secure proxy
 */
async function callOpenAIProxy(endpoint: string, body: any): Promise<any> {
  try {
    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      throw error;
    }

    return await response.json();
  } catch (error: any) {
    // Re-throw with better error handling
    if (error.status === 500) {
      throw new Error('Server error: OpenAI proxy is not configured. Please contact support.');
    }
    throw error;
  }
}

export class BaseAgent {
  private modelName: string;

  constructor(modelName: string = DEFAULT_MODEL) {
    this.modelName = modelName;
  }

  /**
   * Send a prompt to the OpenAI model
   */
  async generate(prompt: string, systemInstruction?: string): Promise<string> {
    try {
      const messages: any[] = [];
      
      // Add system instruction if provided
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      
      // Add user prompt
      messages.push({ role: 'user', content: prompt });

      console.log('[BaseAgent] Calling OpenAI API (via proxy) with model:', this.modelName);
      
      const response = await callOpenAIProxy('/v1/chat/completions', {
        model: this.modelName,
        messages: messages,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: DEFAULT_MAX_TOKENS,
      });

      const text = response.choices?.[0]?.message?.content || '';
      
      if (!text || text.trim().length === 0) {
        console.error('[BaseAgent] Empty response from OpenAI:', {
          response,
          choices: response.choices,
          finishReason: response.choices?.[0]?.finish_reason,
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
      const status = error?.status;

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
    let rawResponse = '';
    try {
      const messages: any[] = [];
      
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

      console.log('[BaseAgent] Calling OpenAI API for JSON (via proxy) with model:', this.modelName);
      
      const response = await callOpenAIProxy('/v1/chat/completions', {
        model: this.modelName,
        messages: messages,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: DEFAULT_MAX_TOKENS,
        // Use response_format for structured JSON when schema is provided
        ...(schema ? { response_format: { type: 'json_object' } } : {}),
      });

      rawResponse = response.choices?.[0]?.message?.content || '';
      
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
   * Generate JSON response with schema validation, supporting vision (images)
   */
  async generateJSONWithVision<T>(
    textPrompt: string,
    imageUrl: string | null,
    systemInstruction?: string,
    schema?: any
  ): Promise<T> {
    let rawResponse = '';
    try {
      const messages: any[] = [];
      
      // Add system instruction if provided
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      
      // Build content array for user message
      const content: any[] = [];
      
      // Build the text prompt with schema instructions if needed
      let finalTextPrompt = textPrompt || '';
      
      // Add schema instruction for JSON response
      if (schema) {
        let schemaInstruction = '';
        if (schema.type === 'array') {
          schemaInstruction = '\n\nIMPORTANT: Respond with ONLY a valid JSON array directly (not wrapped in an object or schema structure). Example: [{"key": "value"}, {"key": "value"}]\n' +
                           'Do NOT return a schema structure like {"type": "array", "items": [...]}. Return the array itself: [...]\n' +
                           'No markdown, no code blocks, no explanation, just the raw JSON array.';
        } else {
          schemaInstruction = '\n\nIMPORTANT: Respond with ONLY a valid JSON object matching this exact schema, no other text:\n' + 
                           JSON.stringify(schema, null, 2) +
                           '\n\nReturn ONLY the JSON object, no markdown, no code blocks, no explanation.';
        }
        finalTextPrompt += schemaInstruction;
      } else {
        // If no schema, add JSON instruction
        if (finalTextPrompt.trim().length > 0) {
          finalTextPrompt += '\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code blocks, no explanation, just the raw JSON.';
        } else {
          finalTextPrompt = 'IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code blocks, no explanation, just the raw JSON.';
        }
      }
      
      // If no text prompt at all, add a default prompt
      if (!finalTextPrompt || finalTextPrompt.trim().length === 0) {
        finalTextPrompt = 'Analyze the provided content and respond with JSON.';
      }
      
      // Add text prompt (required - always have at least text)
      content.push({ 
        type: 'text', 
        text: finalTextPrompt 
      });
      
      // Add image if provided
      if (imageUrl && imageUrl.trim().length > 0) {
        content.push({ 
          type: 'image_url', 
          image_url: { url: imageUrl } 
        });
      }
      
      messages.push({ role: 'user', content: content });

      console.log('[BaseAgent] Calling OpenAI API for JSON with vision (via proxy), model:', this.modelName, 'hasImage:', !!imageUrl);
      
      const response = await callOpenAIProxy('/v1/chat/completions', {
        model: this.modelName,
        messages: messages,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: DEFAULT_MAX_TOKENS,
        // Use response_format for structured JSON when schema is provided
        ...(schema ? { response_format: { type: 'json_object' } } : {}),
      });

      rawResponse = response.choices?.[0]?.message?.content || '';
      
      console.log('[BaseAgent] Raw OpenAI vision response length:', rawResponse.length);
      console.log('[BaseAgent] Raw OpenAI vision response:', rawResponse.substring(0, 300));

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
      
      // Try to find JSON object/array in the text
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
      const jsonArrayMatch = jsonText.match(/\[[\s\S]*\]/);
      
      if (jsonObjectMatch) {
        jsonText = jsonObjectMatch[0];
      } else if (jsonArrayMatch) {
        jsonText = jsonArrayMatch[0];
      }

      if (!jsonText || jsonText.length === 0) {
        throw new Error('No JSON found in response');
      }

      console.log('[BaseAgent] Extracted JSON text length:', jsonText.length);
      console.log('[BaseAgent] Extracted JSON text:', jsonText.substring(0, 300));

      // Parse JSON
      const parsed = JSON.parse(jsonText);
      console.log('[BaseAgent] Successfully parsed JSON from vision response');
      return parsed as T;
    } catch (error: any) {
      console.error('[BaseAgent] JSON parsing error in vision call:', error);
      console.error('[BaseAgent] Raw response that failed:', rawResponse);
      console.error('[BaseAgent] Raw response length:', rawResponse?.length || 0);
      throw new Error(`Failed to parse AI vision response as JSON: ${error.message}`);
    }
  }

  /**
   * Check if the agent is available
   * Now checks if proxy endpoint is accessible (API key is on server)
   */
  static isAvailable(): boolean {
    // The proxy endpoint should always be available if deployed correctly
    // We can't check the actual API key from client, but we can assume
    // the proxy is configured if we're in a deployed environment
    return true; // Proxy availability will be determined at runtime
  }
}

// Export for compatibility (but it's no longer used directly)
export const openai = null;
export default BaseAgent;
