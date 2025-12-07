import { newsApiService } from './newsApiService';
import { botRoutingService } from './botRoutingService';
import { botPostService } from './botPostService';
import { botService } from './botService';
import { BOT_CONFIG_MAP } from './botConfig';
import type { RoutedArticle } from '../../types';

let pipelineTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

const readEnv = (key: string): string | undefined => {
  const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  if (viteEnv && viteEnv[key] !== undefined) {
    return viteEnv[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

const resolveDefaultInterval = (provided?: number): number => {
  if (typeof provided === 'number') {
    return provided;
  }

  const envValue = readEnv('VITE_NEWS_PIPELINE_INTERVAL_MS') || readEnv('NEWS_PIPELINE_INTERVAL_MS');
  if (envValue !== undefined) {
    const parsed = Number(envValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  // Default: 1 hour in production, single run in development
  const isProd = (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) || process.env.NODE_ENV === 'production';
  return isProd ? 3600000 : 0;
};

const validateSetup = (): { valid: boolean; reason?: string } => {
  if (!newsApiService.isConfigured()) {
    return {
      valid: false,
      reason: 'VITE_NEWS_API_KEY environment variable is not set. Bot posts will not be created.',
    };
  }

  if (BOT_CONFIG_MAP.size === 0) {
    return {
      valid: false,
      reason: 'No bot configurations found. BOT_CONFIG_MAP is empty.',
    };
  }

  return { valid: true };
};

const executeCycle = async (): Promise<RoutedArticle[]> => {
  const validation = validateSetup();
  if (!validation.valid) {
    if (!isInitialized) {
      console.warn(`[NewsPipeline] Setup validation failed: ${validation.reason}`);
      isInitialized = true;
    }
    return [];
  }

  try {
    const articles = await newsApiService.fetchDiverseArticles();
    if (articles.length === 0) {
      if (!isInitialized) {
        console.warn('[NewsPipeline] No articles fetched from NewsAPI. Check your API key and network connection.');
        isInitialized = true;
      }
      return [];
    }

    const assignments = botRoutingService.routeArticles(articles);

    if (assignments.length > 0) {
      console.log(`[NewsPipeline] Prepared ${assignments.length} bot assignments with ${articles.length} source articles.`);
      botPostService.enqueue(assignments);
    } else {
      if (!isInitialized) {
        console.warn('[NewsPipeline] No bot assignments created. Check bot routing configuration.');
        isInitialized = true;
      }
    }

    return assignments;
  } catch (error) {
    console.error('[NewsPipeline] Error in executeCycle:', error);
    return [];
  }
};

export const newsPipelineService = {
  async runOnce(): Promise<RoutedArticle[]> {
    try {
      return await executeCycle();
    } catch (error) {
      console.error('[NewsPipeline] Run failed:', error);
      return [];
    }
  },

  async start(intervalMs?: number): Promise<{ success: boolean; reason?: string }> {
    this.stop();

    const resolvedInterval = resolveDefaultInterval(intervalMs);

    // Validate bots are ready
    const botsReady = await botService.validateBotsReady();
    if (!botsReady) {
      const reason = 'Bot profiles are not ready. Ensure bot profiles are created before starting the pipeline.';
      console.error(`[NewsPipeline] ${reason}`);
      return { success: false, reason };
    }

    // Validate setup
    const validation = validateSetup();
    if (!validation.valid) {
      console.error(`[NewsPipeline] Cannot start: ${validation.reason}`);
      return { success: false, reason: validation.reason };
    }

    const isProd =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) ||
      process.env.NODE_ENV === 'production';
    if (resolvedInterval === 0 && isProd) {
      console.warn(
        '[NewsPipeline] Running in single run mode in production. Set VITE_NEWS_PIPELINE_INTERVAL_MS to enable continuous operation.'
      );
    }

    const runner = async () => {
      try {
        await executeCycle();
      } catch (error) {
        console.error('[NewsPipeline] Execution error:', error);
      }
    };

    runner();

    if (resolvedInterval > 0) {
      pipelineTimer = setInterval(runner, resolvedInterval);
      console.log(`[NewsPipeline] Started with interval: ${resolvedInterval}ms`);
    } else {
      console.log('[NewsPipeline] Started (single run mode)');
    }

    isInitialized = true;
    return { success: true };
  },

  stop(): void {
    if (pipelineTimer) {
      clearInterval(pipelineTimer);
      pipelineTimer = null;
      console.log('[NewsPipeline] Stopped');
    }
  },
};

