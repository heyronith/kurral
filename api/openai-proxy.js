/**
 * OpenAI API Proxy - Serverless Function
 * 
 * This function proxies OpenAI API calls from the client to OpenAI's servers.
 * The API key is stored server-side only (in Vercel environment variables),
 * so it's never exposed to the browser.
 * 
 * Usage:
 *   POST /api/openai-proxy
 *   Body: { endpoint, method, body }
 * 
 * Example:
 *   POST /api/openai-proxy
 *   {
 *     "endpoint": "/v1/chat/completions",
 *     "method": "POST",
 *     "body": {
 *       "model": "gpt-4o-mini",
 *       "messages": [...],
 *       "temperature": 0.7,
 *       "max_tokens": 1024
 *     }
 *   }
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  // Get API key from server-side environment variable (never exposed to client)
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.error('[openai-proxy] OPENAI_API_KEY not found in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'OpenAI API key is not configured on the server'
    });
  }

  try {
    // Extract request details from client
    const { endpoint, method = 'POST', body, headers: customHeaders } = req.body;

    if (!endpoint) {
      return res.status(400).json({ 
        error: 'Missing endpoint',
        message: 'Request must include an "endpoint" field (e.g., "/v1/chat/completions")'
      });
    }

    // Build the full OpenAI API URL
    const url = `${OPENAI_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      ...customHeaders, // Allow client to pass additional headers if needed
    };

    console.log(`[openai-proxy] Proxying ${method} request to: ${url}`);

    // Forward the request to OpenAI
    const response = await fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Get response data
    const data = await response.json();

    // Forward the status code and response
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('[openai-proxy] Error proxying request:', error);
    
    // Don't expose internal error details to client
    return res.status(500).json({ 
      error: 'Proxy error',
      message: 'Failed to proxy request to OpenAI API',
      // Only include error message in development
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
}
