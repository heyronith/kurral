// Search Agent - Semantic search understanding and result ranking
import BaseAgent, { type AgentResponse } from './baseAgent';
import type { Chirp, User } from '../../types';

export interface SearchResult {
  chirp: Chirp;
  relevanceScore: number;
  explanation: string;
}

export interface SearchQuery {
  semanticIntent: string;
  keywords: string[];
  topics?: string[];
  users?: string[];
}

const SYSTEM_INSTRUCTION = `You are an expert search query analyzer. Your job is to understand the user's search intent and extract relevant information.

Given a user's search query, determine:
- semanticIntent: What the user is really looking for (paraphrased/cleaned)
- keywords: Important keywords to search for
- topics: Any topics/hashtags mentioned
- users: Any usernames or people mentioned

Respond with JSON containing:
- semanticIntent: A clear description of what the user wants to find
- keywords: Array of important keywords
- topics: Array of topics/hashtags (optional)
- users: Array of usernames/names (optional)`;

export class SearchAgent {
  private agent: BaseAgent;

  constructor() {
    if (!BaseAgent.isAvailable()) {
      throw new Error('OpenAI API is not configured');
    }
    // Use default model (gpt-4o-mini)
    this.agent = new BaseAgent();
  }

  /**
   * Understand and parse a search query
   */
  async understandQuery(query: string): Promise<AgentResponse<SearchQuery>> {
    try {
      const prompt = `Analyze this search query and extract its intent:

Query: "${query}"

Determine what the user is looking for and extract relevant keywords, topics, and user mentions.`;

      const result = await this.agent.generateJSON<SearchQuery>(
        prompt,
        SYSTEM_INSTRUCTION,
        {
          type: 'object',
          properties: {
            semanticIntent: { type: 'string' },
            keywords: {
              type: 'array',
              items: { type: 'string' },
            },
            topics: {
              type: 'array',
              items: { type: 'string' },
            },
            users: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['semanticIntent', 'keywords'],
        }
      );

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('SearchAgent error:', error);
      
      // Fallback: simple keyword extraction
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const fallback: SearchQuery = {
        semanticIntent: query,
        keywords,
      };

      return {
        success: false,
        error: error.message || 'Failed to understand query',
        fallback,
      };
    }
  }

  /**
   * Rank search results by relevance to the query
   */
  async rankResults(
    query: string,
    chirps: Chirp[],
    getAuthor: (userId: string) => User | undefined,
    limit: number = 20
  ): Promise<AgentResponse<SearchResult[]>> {
    try {
      // First understand the query
      const queryAnalysis = await this.understandQuery(query);
      if (!queryAnalysis.success || !queryAnalysis.data) {
        throw new Error('Failed to understand query');
      }

      const { semanticIntent, keywords } = queryAnalysis.data;

      // Create a prompt to rank the results
      const chirpsData = chirps.slice(0, 50).map(chirp => {
        const author = getAuthor(chirp.authorId);
        return {
          id: chirp.id,
          text: chirp.text,
          topic: chirp.topic,
          author: author?.handle || 'unknown',
          createdAt: chirp.createdAt.toISOString(),
        };
      });

      const rankingPrompt = `Rank these chirps by relevance to this search query:

Query: "${query}"
Intent: "${semanticIntent}"
Keywords: ${keywords.join(', ')}

Chirps to rank:
${JSON.stringify(chirpsData, null, 2)}

For each chirp, provide:
- id: The chirp ID
- relevanceScore: A score from 0-1 indicating relevance
- explanation: Brief explanation of why it's relevant (or not)

Return top ${limit} most relevant results sorted by relevanceScore descending.

IMPORTANT: Return ONLY a JSON array of objects, not a schema or wrapper object. Example format:
[
  {"id": "chirp1", "relevanceScore": 0.9, "explanation": "Highly relevant"},
  {"id": "chirp2", "relevanceScore": 0.7, "explanation": "Somewhat relevant"}
]`;

      const rankingSystemInstruction = `You are an expert relevance ranker. Analyze chirps and rank them by how well they match the search query.

Consider:
- Text content matching (keywords, semantic similarity)
- Topic relevance
- Recency (newer is slightly better)
- Author relevance if mentioned

Provide scores from 0-1, where 1 is highly relevant and 0 is not relevant.

Return ONLY a JSON array directly, not wrapped in any object or schema structure.`;

      interface RankedResult {
        id: string;
        relevanceScore: number;
        explanation: string;
      }

      const response = await this.agent.generateJSON<any>(
        rankingPrompt,
        rankingSystemInstruction,
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              relevanceScore: { type: 'number', minimum: 0, maximum: 1 },
              explanation: { type: 'string' },
            },
            required: ['id', 'relevanceScore', 'explanation'],
          },
        }
      );

      // Handle case where AI returns schema structure instead of array
      let rankedResults: RankedResult[];
      if (Array.isArray(response)) {
        // Direct array response (correct)
        rankedResults = response;
      } else if (response && typeof response === 'object' && 'items' in response && Array.isArray(response.items)) {
        // Schema structure with items array (incorrect but we can extract it)
        console.warn('[SearchAgent] AI returned schema structure, extracting items array');
        rankedResults = response.items;
      } else if (response && typeof response === 'object' && 'results' in response && Array.isArray(response.results)) {
        // Wrapped in results property
        console.warn('[SearchAgent] AI returned wrapped structure, extracting results array');
        rankedResults = response.results;
      } else {
        throw new Error(`Unexpected response format: ${JSON.stringify(response).substring(0, 200)}`);
      }

      // Map results back to chirps
      const results: SearchResult[] = rankedResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit)
        .map(ranked => {
          const chirp = chirps.find(c => c.id === ranked.id);
          if (!chirp) {
            throw new Error(`Chirp ${ranked.id} not found`);
          }
          return {
            chirp,
            relevanceScore: ranked.relevanceScore,
            explanation: ranked.explanation,
          };
        })
        .filter((r): r is SearchResult => r.chirp !== undefined);

      return {
        success: true,
        data: results,
      };
    } catch (error: any) {
      console.error('SearchAgent ranking error:', error);
      
      // Fallback: simple keyword-based ranking
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const fallback: SearchResult[] = chirps
        .map(chirp => {
          const text = chirp.text.toLowerCase();
          const topic = chirp.topic.toLowerCase();
          const score = keywords.reduce((acc, keyword) => {
            if (text.includes(keyword) || topic.includes(keyword)) {
              return acc + 1 / keywords.length;
            }
            return acc;
          }, 0);
          
          return {
            chirp,
            relevanceScore: score,
            explanation: score > 0 ? 'Matches search keywords' : 'Does not match search',
          };
        })
        .filter(r => r.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      return {
        success: false,
        error: error.message || 'Failed to rank results',
        fallback,
      };
    }
  }
}

// Export singleton instance
let searchAgentInstance: SearchAgent | null = null;

export const getSearchAgent = (): SearchAgent | null => {
  if (!BaseAgent.isAvailable()) {
    return null;
  }
  
  if (!searchAgentInstance) {
    try {
      searchAgentInstance = new SearchAgent();
    } catch (error) {
      console.error('Failed to initialize SearchAgent:', error);
      return null;
    }
  }
  
  return searchAgentInstance;
};

