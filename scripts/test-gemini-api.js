// Test Gemini API directly to find working model
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error('❌ VITE_GEMINI_API_KEY not found');
  process.exit(1);
}

console.log('🔍 Testing different model names and API versions...\n');

const modelsToTest = [
  // v1beta models
  { version: 'v1beta', model: 'gemini-pro' },
  { version: 'v1beta', model: 'gemini-1.5-pro' },
  { version: 'v1beta', model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'models/gemini-pro' },
  
  // v1 models
  { version: 'v1', model: 'gemini-pro' },
  { version: 'v1', model: 'gemini-1.5-pro' },
  { version: 'v1', model: 'gemini-1.5-flash' },
  { version: 'v1', model: 'models/gemini-pro' },
];

async function testModel(version, model) {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Say hello' }]
        }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS: ${version}/${model}`);
      return true;
    } else {
      const error = await response.text();
      if (response.status === 404) {
        console.log(`❌ 404: ${version}/${model} - Not found`);
      } else {
        console.log(`❌ ${response.status}: ${version}/${model} - ${error.substring(0, 100)}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${version}/${model} - ${error.message}`);
    return false;
  }
}

async function testAll() {
  for (const { version, model } of modelsToTest) {
    const success = await testModel(version, model);
    if (success) {
      console.log(`\n🎉 Found working model: ${version}/${model}`);
      console.log(`\nUpdate your code to use: '${model}' with API version ${version}`);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
}

testAll();

