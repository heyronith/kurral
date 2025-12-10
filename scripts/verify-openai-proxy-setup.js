#!/usr/bin/env node

/**
 * Verify OpenAI Proxy Setup
 * 
 * This script helps verify that the OpenAI proxy is correctly configured
 * in your Vercel deployment.
 * 
 * Usage:
 *   node scripts/verify-openai-proxy-setup.js [your-vercel-url]
 * 
 * Example:
 *   node scripts/verify-openai-proxy-setup.js https://www.mykural.app
 */

const BASE_URL = process.argv[2] || 'https://www.mykural.app';

async function checkHealth() {
  console.log('🔍 Checking OpenAI Proxy Configuration...\n');
  console.log(`📍 Checking: ${BASE_URL}\n`);

  try {
    const healthUrl = `${BASE_URL}/api/openai-proxy-health`;
    console.log(`📡 Calling: ${healthUrl}`);
    
    const response = await fetch(healthUrl);
    const data = await response.json();

    console.log('\n📊 Health Check Results:');
    console.log('─'.repeat(50));
    console.log(`Status: ${data.status}`);
    console.log(`Message: ${data.message}`);
    console.log('\nDetails:');
    console.log(`  - Has OpenAI API Key: ${data.details.hasOpenAIApiKey ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Key Prefix: ${data.details.keyPrefix || 'N/A'}`);
    console.log(`  - OpenAI Env Vars Found: ${data.details.openaiEnvVars.join(', ') || 'None'}`);
    console.log(`  - Node Environment: ${data.details.nodeEnv || 'N/A'}`);

    if (!data.details.hasOpenAIApiKey) {
      console.log('\n❌ PROBLEM DETECTED: OpenAI API Key is not configured!\n');
      console.log('📋 Setup Instructions:');
      console.log('─'.repeat(50));
      if (data.instructions) {
        Object.entries(data.instructions).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });
      }
      console.log('\n💡 After setting the environment variable:');
      console.log('   1. Go to Vercel Dashboard → Deployments');
      console.log('   2. Click "Redeploy" on the latest deployment');
      console.log('   3. Wait for deployment to complete');
      console.log('   4. Run this script again to verify\n');
      process.exit(1);
    } else {
      console.log('\n✅ OpenAI Proxy is correctly configured!\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error checking health:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Your Vercel URL is correct');
    console.error('   2. The deployment is live');
    console.error('   3. The /api/openai-proxy-health endpoint is accessible\n');
    process.exit(1);
  }
}

checkHealth();
