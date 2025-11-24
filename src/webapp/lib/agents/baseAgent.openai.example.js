// Example OpenAI implementation (for reference)
import OpenAI from 'openai';
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
if (!API_KEY) {
    console.warn('VITE_OPENAI_API_KEY is not set. AI features will not work.');
}
const openai = API_KEY ? new OpenAI({ apiKey: API_KEY, dangerouslyAllowBrowser: true }) : null;
const DEFAULT_MODEL = 'gpt-4o-mini'; // or 'gpt-3.5-turbo' for cheaper option
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;
export class BaseAgent {
    constructor(modelName = DEFAULT_MODEL) {
        Object.defineProperty(this, "modelName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (!openai) {
            throw new Error('OpenAI API key is not configured');
        }
        this.modelName = modelName;
    }
    async generate(prompt, systemInstruction) {
        if (!openai) {
            throw new Error('OpenAI not initialized');
        }
        try {
            const messages = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });
            const response = await openai.chat.completions.create({
                model: this.modelName,
                messages: messages,
                temperature: DEFAULT_TEMPERATURE,
                max_tokens: DEFAULT_MAX_TOKENS,
            });
            const text = response.choices[0]?.message?.content || '';
            if (!text || text.trim().length === 0) {
                throw new Error('API_RATE_LIMIT: OpenAI returned empty response');
            }
            return text.trim();
        }
        catch (error) {
            console.error('[BaseAgent] OpenAI error:', error);
            // Check for rate limit errors
            const errorMessage = error?.message || '';
            const isRateLimit = errorMessage.includes('429') ||
                errorMessage.includes('rate_limit') ||
                error?.status === 429 ||
                error?.response?.status === 429;
            if (isRateLimit) {
                throw new Error('API rate limit exceeded. Please wait a moment and try again.');
            }
            throw new Error(`AI generation failed: ${error?.message || 'Unknown error'}`);
        }
    }
    async generateJSON(prompt, systemInstruction, schema) {
        if (!openai) {
            throw new Error('OpenAI not initialized');
        }
        try {
            const messages = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            // Add schema instruction for JSON response
            let jsonPrompt = prompt;
            if (schema) {
                jsonPrompt += '\n\nIMPORTANT: Respond with ONLY a valid JSON object matching this exact schema, no other text:\n' +
                    JSON.stringify(schema, null, 2) +
                    '\n\nReturn ONLY the JSON object, no markdown, no code blocks, no explanation.';
            }
            else {
                jsonPrompt += '\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code blocks, no explanation, just the raw JSON.';
            }
            messages.push({ role: 'user', content: jsonPrompt });
            const response = await openai.chat.completions.create({
                model: this.modelName,
                messages: messages,
                temperature: DEFAULT_TEMPERATURE,
                max_tokens: DEFAULT_MAX_TOKENS,
                response_format: schema ? { type: 'json_object' } : undefined,
            });
            const text = response.choices[0]?.message?.content || '';
            if (!text || text.trim().length === 0) {
                throw new Error('API_RATE_LIMIT: OpenAI returned empty response');
            }
            // Extract JSON (same logic as Gemini version)
            let jsonText = text.trim();
            // Remove markdown code blocks if present
            if (jsonText.includes('```json')) {
                const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
                if (match && match[1]) {
                    jsonText = match[1].trim();
                }
            }
            else if (jsonText.includes('```')) {
                const match = jsonText.match(/```[^\n]*\s*([\s\S]*?)\s*```/);
                if (match && match[1]) {
                    jsonText = match[1].trim();
                }
            }
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }
            return JSON.parse(jsonText);
        }
        catch (error) {
            console.error('[BaseAgent] JSON parsing error:', error);
            throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
        }
    }
    static isAvailable() {
        return !!openai && !!API_KEY;
    }
}
export default BaseAgent;
