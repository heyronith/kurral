// Script to list available Gemini models
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error('❌ VITE_GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

console.log('🔍 Listing available Gemini models...\n');

const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
  try {
    // Try to list models (if API supports it)
    console.log('Testing model: gemini-1.5-pro');
    const model1 = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    console.log('✅ gemini-1.5-pro model object created');

    console.log('\nTesting model: gemini-pro');
    const model2 = genAI.getGenerativeModel({ model: 'gemini-pro' });
    console.log('✅ gemini-pro model object created');

    console.log('\nTesting model: gemini-1.0-pro');
    const model3 = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    console.log('✅ gemini-1.0-pro model object created');

    // Try to actually call the API
    console.log('\n🔬 Testing actual API call with gemini-1.5-pro...');
    const result = await model1.generateContent('Say "Hello"');
    const response = await result.response;
    console.log('✅ API call successful! Response:', response.text());
    console.log('\n✅ gemini-1.5-pro is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('404')) {
      console.error('\n💡 Model not found. This means the model name is incorrect or not available with your API key.');
      console.error('💡 Try different model names or check your API key permissions.');
    }
    process.exit(1);
  }
}

listModels();

