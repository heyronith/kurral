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
    console.error('[openai-proxy] Available env vars:', Object.keys(process.env).filter(k => k.includes('OPENAI')));
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'OpenAI API key is not configured on the server. Please set OPENAI_API_KEY in Vercel environment variables.',
      details: 'The OPENAI_API_KEY environment variable is missing. Go to Vercel Dashboard → Settings → Environment Variables → Add OPENAI_API_KEY'
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
    // Fix: Remove /v1 from endpoint if it's already in base URL, or just use base without v1
    const cleanEndpoint = endpoint.startsWith('/v1/') ? endpoint.substring(3) : endpoint;
    const url = `${OPENAI_BASE_URL}${cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`}`;

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

    // Try to parse response as JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[openai-proxy] Failed to parse JSON response:', parseError);
        const text = await response.text();
        return res.status(502).json({
          error: 'Invalid upstream response',
          message: 'OpenAI API returned invalid JSON',
          details: text.substring(0, 500) // Return first 500 chars of text for debugging
        });
      }
    } else {
      // Handle non-JSON response (likely an error page)
      const text = await response.text();
      // If it's an error status, return it wrapped in JSON
      if (!response.ok) {
        return res.status(response.status).json({
          error: `Upstream Error ${response.status}`,
          message: text.substring(0, 500) || 'Unknown upstream error'
        });
      }
      // If it's a success but not JSON (unexpected for OpenAI), return as text-wrapped JSON
      data = { text_response: text };
    }

    // Forward the status code and response
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('[openai-proxy] Error proxying request:', error);
    console.error('[openai-proxy] Error details:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Proxy error',
      message: 'Failed to proxy request to OpenAI API',
      details: error.message,
      code: error.code
    });
  }
}
