/**
 * OpenAI Proxy Health Check
 * 
 * This endpoint helps diagnose configuration issues with the OpenAI proxy.
 * It checks if the OPENAI_API_KEY is configured without making actual API calls.
 */

export default async function handler(req, res) {
  // Allow GET for health checks
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET requests'
    });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const hasKey = !!OPENAI_API_KEY;
  const keyPrefix = OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 7) : 'N/A';
  
  // Check for other OpenAI-related env vars (for debugging)
  const openaiEnvVars = Object.keys(process.env).filter(k => 
    k.includes('OPENAI') || k.includes('openai')
  );

  return res.status(200).json({
    status: hasKey ? 'configured' : 'missing',
    message: hasKey 
      ? 'OpenAI API key is configured' 
      : 'OpenAI API key is NOT configured',
    details: {
      hasOpenAIApiKey: hasKey,
      keyPrefix: hasKey ? `${keyPrefix}...` : null,
      openaiEnvVars: openaiEnvVars,
      nodeEnv: process.env.NODE_ENV,
    },
    instructions: hasKey ? null : {
      step1: 'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
      step2: 'Click "Add New"',
      step3: 'Name: OPENAI_API_KEY',
      step4: 'Value: Your OpenAI API key (starts with sk-...)',
      step5: 'Select all environments (Production, Preview, Development)',
      step6: 'Click "Save"',
      step7: 'Redeploy your application'
    }
  });
}
