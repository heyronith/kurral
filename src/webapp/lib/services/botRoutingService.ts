import { BOT_ROSTER } from './botConfig';
import { articleProcessingService } from './articleProcessingService';
import type { BotProfileConfig, BotType, NewsArticle, RoutedArticle } from '../../types';

const botsByType = BOT_ROSTER.reduce((acc, bot) => {
  const bucket = acc.get(bot.botType) ?? [];
  bucket.push(bot);
  acc.set(bot.botType, bucket);
  return acc;
}, new Map<BotType, BotProfileConfig[]>());

const rotationIndices: Record<BotType, number> = {
  news: 0,
  tech: 0,
  science: 0,
  finance: 0,
  sports: 0,
  entertainment: 0,
  culture: 0,
  global: 0,
  climate: 0,
  lifestyle: 0,
  gaming: 0,
  education: 0,
};

const pickBotForType = (type: BotType): BotProfileConfig | null => {
  const candidates = botsByType.get(type);
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const index = rotationIndices[type] ?? 0;
  const selected = candidates[index % candidates.length];
  rotationIndices[type] = index + 1;

  return selected;
};

const getFallbackBot = (): BotProfileConfig | null => {
  return BOT_ROSTER.find((bot) => bot.botType === 'news') ?? null;
};

export const botRoutingService = {
  routeArticles(articles: NewsArticle[]): RoutedArticle[] {
    const assignments: RoutedArticle[] = [];

    const deduped = articleProcessingService.dedupe(articles);
    for (const article of deduped) {
      const classification = articleProcessingService.classify(article);
      const bot = pickBotForType(classification.botType) ?? getFallbackBot();
      if (!bot) {
        continue;
      }

      assignments.push({
        id: `${article.id}::${bot.botId}`,
        article,
        classification,
        assignedBotId: bot.botId,
        assignedBotType: bot.botType,
        assignedAt: new Date(),
      });
    }

    return assignments;
  },
};

