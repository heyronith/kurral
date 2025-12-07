/**
 * Server-side bot worker
 * Runs news pipeline and bot post dispatcher outside the browser.
 */
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables BEFORE any other imports
// Try root .env first, then env/.env as fallback
const rootEnvPath = join(__dirname, '..', '.env');
const envFolderPath = join(__dirname, '..', 'env', '.env');

let envPath = rootEnvPath;
if (!existsSync(rootEnvPath) && existsSync(envFolderPath)) {
  envPath = envFolderPath;
}

const result = config({ path: envPath });
if (result.error && !existsSync(envPath)) {
  console.error(`[BotWorker] Failed to load .env file from: ${envPath}`);
  console.error(`[BotWorker] Error: ${result.error.message}`);
  process.exit(1);
}

// Verify critical env vars are loaded
if (!process.env.VITE_FIREBASE_API_KEY && !process.env.FIREBASE_API_KEY) {
  console.error('[BotWorker] VITE_FIREBASE_API_KEY or FIREBASE_API_KEY must be set in .env file');
  process.exit(1);
}

// Now dynamically import modules that depend on environment variables
async function startWorker() {
  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  const { db } = await import('../src/webapp/lib/firebase');
  const { botService } = await import('../src/webapp/lib/services/botService');
  const { botPostService } = await import('../src/webapp/lib/services/botPostService');
  const { newsPipelineService } = await import('../src/webapp/lib/services/newsPipelineService');

  const readEnvNumber = (key: string, fallback: number): number => {
    const raw = process.env[key];
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const posterIntervalMs = readEnvNumber('VITE_BOT_POSTER_INTERVAL_MS', 15000);
  const pipelineIntervalMs = readEnvNumber('VITE_NEWS_PIPELINE_INTERVAL_MS', 3600000);
  const workerId =
    process.env.BOT_WORKER_ID || `bot-worker-${Math.random().toString(36).slice(2, 8)}`;

  console.log('[BotWorker] Initializing bot worker...');

  const botResult = await botService.ensureBotProfiles();
  if (!botResult.success || botResult.bots.length === 0) {
    throw new Error(`[BotWorker] Failed to ensure bot profiles: ${botResult.error || 'no bots created'}`);
  }
  console.log(`[BotWorker] Ensured ${botResult.bots.length} bot profiles.`);

  const postResult = botPostService.start(posterIntervalMs);
  if (!postResult.success) {
    throw new Error(`[BotWorker] Failed to start bot post service: ${postResult.reason}`);
  }

  const pipelineResult = await newsPipelineService.start(pipelineIntervalMs);
  if (!pipelineResult.success) {
    throw new Error(`[BotWorker] Failed to start news pipeline: ${pipelineResult.reason}`);
  }

  console.log(
    `[BotWorker] Worker started. Pipeline interval=${pipelineIntervalMs}ms, poster interval=${posterIntervalMs}ms (id=${workerId}).`
  );

  // Lightweight heartbeat for visibility
  const heartbeat = async () => {
    try {
      const ref = doc(db, 'botWorkerHealth', workerId);
      await setDoc(
        ref,
        {
          workerId,
          posterIntervalMs,
          pipelineIntervalMs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[BotWorker] Failed to write heartbeat:', (error as any)?.message || error);
    }
  };

  await heartbeat();
  setInterval(heartbeat, 5 * 60 * 1000);
}

startWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});

const shutdown = async () => {
  console.log('[BotWorker] Shutting down...');
  const { botPostService } = await import('../src/webapp/lib/services/botPostService');
  const { newsPipelineService } = await import('../src/webapp/lib/services/newsPipelineService');
  botPostService.stop();
  newsPipelineService.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
