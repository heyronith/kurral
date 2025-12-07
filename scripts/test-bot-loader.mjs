// Custom loader for tsx to inject environment variables into import.meta.env
// Usage: tsx --loader ./scripts/test-bot-loader.mjs scripts/test-bot-feature-e2e.js

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

export async function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  
  // If this is a TypeScript/JavaScript file, inject environment variables
  if (url.endsWith('.ts') || url.endsWith('.js') || url.endsWith('.tsx') || url.endsWith('.jsx')) {
    if (result.format === 'module' && result.source) {
      // Replace import.meta.env.VITE_* with process.env.VITE_*
      const source = typeof result.source === 'string' ? result.source : result.source.toString();
      const modified = source.replace(
        /import\.meta\.env\.(VITE_\w+)/g,
        (match, envVar) => {
          const value = process.env[envVar] || '';
          return JSON.stringify(value);
        }
      );
      
      return {
        ...result,
        source: modified,
      };
    }
  }
  
  return result;
}

