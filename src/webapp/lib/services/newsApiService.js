const readEnv = (key) => {
    const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    if (viteEnv && viteEnv[key] !== undefined) {
        return viteEnv[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
        return process.env[key];
    }
    return undefined;
};
const API_KEY = readEnv('VITE_NEWS_API_KEY') || readEnv('NEWS_API_KEY');
const BASE_URL = 'https://newsdata.io/api/1';
// newsdata.io free tier has a maximum size of 10
const MAX_PAGE_SIZE = 10;
const CATEGORY_CONFIGS = [
    { category: 'business', pageSize: 10 },
    { category: 'technology', pageSize: 10 },
    { category: 'science', pageSize: 10 },
    { category: 'sports', pageSize: 10 },
    { category: 'health', pageSize: 10 },
    { category: 'entertainment', pageSize: 10 },
    { category: 'general', pageSize: 10 },
];
const QUERY_CONFIGS = [
    { query: 'artificial intelligence', category: 'technology', pageSize: 10 },
    { query: 'startup funding', category: 'technology', pageSize: 10 },
    { query: 'product launch', category: 'technology', pageSize: 10 },
    { query: 'cybersecurity breach', category: 'technology', pageSize: 10 },
    { query: 'climate change', category: 'climate', pageSize: 10 },
    { query: 'space exploration', category: 'science', pageSize: 10 },
    { query: 'medical breakthrough', category: 'science', pageSize: 10 },
    { query: 'stock market', category: 'finance', pageSize: 10 },
    { query: 'interest rates', category: 'finance', pageSize: 10 },
    { query: 'crypto regulation', category: 'finance', pageSize: 10 },
    { query: 'NBA playoff', category: 'sports', pageSize: 10 },
    { query: 'film release', category: 'entertainment', pageSize: 10 },
];
const buildArticleId = (raw, suffix) => {
    // Use article_id from newsdata.io or fallback to link + pubDate
    const base = raw.article_id || `${raw.link}::${raw.pubDate}`;
    return `${base}::${suffix}`;
};
const transformArticle = (raw, metadata) => {
    // Parse pubDate (format: "2025-12-06 23:17:00")
    let publishedDate;
    try {
        publishedDate = new Date(raw.pubDate);
        if (isNaN(publishedDate.getTime())) {
            publishedDate = new Date();
        }
    }
    catch {
        publishedDate = new Date();
    }
    // Extract primary category from newsdata.io's category array
    const primaryCategory = metadata.category || raw.category?.[0] || 'general';
    return {
        id: buildArticleId(raw, metadata.tag),
        title: raw.title || raw.description || 'Untitled',
        description: raw.description,
        content: raw.content,
        url: raw.link,
        urlToImage: raw.image_url,
        sourceId: raw.source_id ?? null,
        sourceName: raw.source_name ?? 'newsdata.io',
        publishedAt: publishedDate,
        category: primaryCategory,
        query: metadata.query,
        fetchedAt: new Date(),
    };
};
const ensureConfigured = () => {
    if (!API_KEY) {
        console.warn('[NewsApiService] Missing VITE_NEWS_API_KEY environment variable.');
        return false;
    }
    // Validate key format - newsdata.io keys can start with 'pub_' or be alphanumeric
    if (API_KEY.length < 20) {
        console.warn('[NewsApiService] Warning: API key appears to be too short.');
    }
    return true;
};
const fetchJson = async (path, params) => {
    const url = new URL(`${BASE_URL}/${path}`);
    // Ensure API key is properly set
    const apiKey = API_KEY?.trim();
    if (!apiKey) {
        throw new Error('newsdata.io API key is not configured');
    }
    // newsdata.io uses API key as query parameter, not header
    url.searchParams.set('apikey', apiKey);
    // Add other query parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, value);
        }
    });
    const response = await fetch(url.toString());
    if (!response.ok) {
        const text = await response.text();
        let errorMessage = `newsdata.io error (${response.status}): ${text}`;
        // Handle rate limiting gracefully (429) - don't throw, return empty array
        if (response.status === 429) {
            try {
                const errorData = JSON.parse(text);
                console.warn(`[NewsApiService] Rate limit exceeded: ${errorData.results?.message || 'Too many requests'}`);
                console.warn('[NewsApiService] Will retry on next cycle. Consider upgrading your newsdata.io plan for higher limits.');
            }
            catch (parseError) {
                // If we can't parse, just log the warning
                console.warn('[NewsApiService] Rate limit exceeded. Will retry on next cycle.');
            }
            // Return empty array instead of throwing - allows pipeline to continue
            return { status: 'success', results: [] };
        }
        // Provide helpful error messages for common issues
        if (response.status === 401 || response.status === 403) {
            try {
                const errorData = JSON.parse(text);
                errorMessage += '\n[NewsApiService] ⚠️  API Key Validation Failed:';
                errorMessage += '\n  Your API key appears to be invalid or incorrect.';
                errorMessage += '\n  ';
                errorMessage += '\n  Troubleshooting steps:';
                errorMessage += '\n  1. Verify the key in your .env file matches your newsdata.io account';
                errorMessage += '\n  2. newsdata.io keys typically start with "pub_" prefix';
                errorMessage += '\n  3. Check if your key has expired or been revoked';
                errorMessage += '\n  4. Visit https://newsdata.io/dashboard to verify your API key status';
                errorMessage += '\n  5. Get a new API key at https://newsdata.io/register';
                errorMessage += '\n  ';
                errorMessage += `\n  Current key format: ${apiKey.substring(0, 10)}... (length: ${apiKey.length})`;
            }
            catch (parseError) {
                // If we can't parse the error, just use the original message
            }
            throw new Error(errorMessage);
        }
        // Handle 422 (validation errors) - log and return empty
        if (response.status === 422) {
            try {
                const errorData = JSON.parse(text);
                console.warn(`[NewsApiService] Validation error: ${errorData.results?.message || 'Invalid request parameters'}`);
            }
            catch (parseError) {
                console.warn('[NewsApiService] Validation error. Check request parameters.');
            }
            return { status: 'success', results: [] };
        }
        throw new Error(errorMessage);
    }
    const body = await response.json();
    // newsdata.io uses 'success' status, not 'ok'
    if (body.status === 'error') {
        throw new Error(`newsdata.io reported failure: ${body.message || 'unknown error'}`);
    }
    return body;
};
const fetchTopHeadlines = async (config) => {
    // newsdata.io uses 'news' endpoint with category parameter
    // Cap size at MAX_PAGE_SIZE to respect API limits
    const size = Math.min(config.pageSize, MAX_PAGE_SIZE);
    const params = {
        category: config.category,
        country: 'us',
        language: 'en',
        size: String(size), // newsdata.io uses 'size' instead of 'pageSize'
    };
    const result = await fetchJson('news', params);
    return (result.results || []).map((article) => transformArticle(article, { category: config.category, tag: `category:${config.category}` }));
};
const fetchEverything = async (config) => {
    // newsdata.io uses 'news' endpoint with q parameter for search
    // Cap size at MAX_PAGE_SIZE to respect API limits
    const size = Math.min(config.pageSize, MAX_PAGE_SIZE);
    const params = {
        q: config.query,
        language: 'en',
        size: String(size), // newsdata.io uses 'size' instead of 'pageSize'
    };
    const result = await fetchJson('news', params);
    return (result.results || []).map((article) => transformArticle(article, {
        category: config.category,
        query: config.query,
        tag: `query:${config.query}`,
    }));
};
export const newsApiService = {
    isConfigured: () => ensureConfigured(),
    async fetchDiverseArticles() {
        if (!ensureConfigured()) {
            return [];
        }
        const collected = [];
        for (const categoryConfig of CATEGORY_CONFIGS) {
            try {
                const articles = await fetchTopHeadlines(categoryConfig);
                collected.push(...articles);
            }
            catch (error) {
                console.warn(`[NewsApiService] Failed to load category ${categoryConfig.category}:`, error);
            }
        }
        for (const queryConfig of QUERY_CONFIGS) {
            try {
                const articles = await fetchEverything(queryConfig);
                collected.push(...articles);
            }
            catch (error) {
                console.warn(`[NewsApiService] Failed to load query "${queryConfig.query}":`, error);
            }
        }
        return collected;
    },
};
