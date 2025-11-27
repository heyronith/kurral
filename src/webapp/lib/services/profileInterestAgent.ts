import { BaseAgent } from '../agents/baseAgent';

const SYSTEM_INSTRUCTION = `You are an interests extractor. Given a natural language sentence describing what someone wants to see in their feed, extract a list of topical interest keywords. Return ONLY a JSON array of strings, where each string is a keyword (1-3 words max). Focus on actionable topics like "ai research", "public policy", "sports". Do NOT return an object, only an array. Example: ["ai research", "sports", "technology"]`;

export async function extractInterestsFromStatement(statement: string): Promise<string[]> {
  if (!statement.trim()) {
    return [];
  }

  if (!BaseAgent.isAvailable()) {
    console.warn('[ProfileInterestAgent] BaseAgent unavailable, skipping interest extraction');
    return [];
  }

  try {
    const agent = new BaseAgent();
    const prompt = `Extract interest keywords from this statement: "${statement.trim()}"\n\nYou must return a JSON array of strings. Each string is a keyword (1-3 words).\n\nExample: ["ai research", "sports", "technology"]\n\nReturn ONLY the JSON array, nothing else.`;

    // Use generate() instead of generateJSON() to get raw text, then parse manually
    // This avoids the json_object response_format issue
    const rawResponse = await agent.generate(prompt, SYSTEM_INSTRUCTION);
    
    // Extract JSON array from response
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
    
    // Try to find JSON array in the text
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonText = arrayMatch[0];
    }
    
    let result: any;
    try {
      result = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[ProfileInterestAgent] Failed to parse JSON:', parseError, 'Raw response:', rawResponse);
      return [];
    }
    
    // Validate that result is actually an array
    if (!Array.isArray(result)) {
      console.warn('[ProfileInterestAgent] AI returned non-array result:', result);
      
      // Try to extract array from object if it's a boolean map
      if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
        const extractedFromObject = Object.entries(result)
          .filter(([key, value]) => value === true)
          .map(([key]) => key.toLowerCase().trim())
          .filter((item) => item.length > 0);
        
        if (extractedFromObject.length > 0) {
          console.log('[ProfileInterestAgent] Extracted interests from object format:', extractedFromObject);
          return extractedFromObject.slice(0, 10);
        }
      }
      
      return [];
    }

    const normalized = result
      .map((item) => {
        // Handle both string and non-string items
        const str = typeof item === 'string' ? item : String(item);
        return str.toLowerCase().trim();
      })
      .filter((item) => item.length > 0 && item.length <= 50) // Reasonable length limit
      .slice(0, 10);

    const unique = Array.from(new Set(normalized));
    return unique;
  } catch (error: any) {
    console.error('[ProfileInterestAgent] Failed to extract interests:', error);
    return [];
  }
}

