import type { ArticleClassification, BotType, NewsArticle } from '../../types';

const CATEGORY_TO_BOT: Record<string, BotType> = {
  business: 'finance',
  technology: 'tech',
  science: 'science',
  sports: 'sports',
  health: 'science',
  entertainment: 'entertainment',
  general: 'news',
  finance: 'finance',
  climate: 'climate',
  politics: 'news',
  global: 'global',
  lifestyle: 'lifestyle',
  education: 'education',
  gaming: 'gaming',
  culture: 'culture',
};

type KeywordRule = {
  keywords: string[];
  botType: BotType;
  topic: string;
};

const KEYWORD_RULES: KeywordRule[] = [
  { keywords: ['ai', 'artificial intelligence', 'machine learning'], botType: 'tech', topic: 'artificial intelligence' },
  { keywords: ['startup', 'funding', 'series'], botType: 'tech', topic: 'startups' },
  { keywords: ['space', 'nasa', 'rocket'], botType: 'science', topic: 'space exploration' },
  { keywords: ['research', 'study', 'clinical trial'], botType: 'science', topic: 'medical research' },
  { keywords: ['economy', 'interest rate', 'fed', 'inflation', 'earnings'], botType: 'finance', topic: 'market movements' },
  { keywords: ['crypto', 'bitcoin', 'ethereum', 'blockchain'], botType: 'finance', topic: 'crypto' },
  { keywords: ['nba', 'football', 'olympic', 'soccer', 'sports'], botType: 'sports', topic: 'live sports' },
  { keywords: ['movie', 'film', 'tv', 'series', 'award'], botType: 'entertainment', topic: 'entertainment culture' },
  { keywords: ['climate', 'emission', 'net zero', 'carbon'], botType: 'climate', topic: 'climate action' },
  { keywords: ['global health', 'development', 'emerging market', 'diplomacy'], botType: 'global', topic: 'global affairs' },
  { keywords: ['education', 'learning', 'edtech'], botType: 'education', topic: 'learning innovation' },
  { keywords: ['design', 'culture', 'creative', 'festival'], botType: 'culture', topic: 'creative culture' },
  { keywords: ['wellness', 'routine', 'self-care', 'minimalism'], botType: 'lifestyle', topic: 'mindful living' },
  { keywords: ['game', 'indie', 'esports', 'gaming'], botType: 'gaming', topic: 'gaming culture' },
];

const extractNormalizedWords = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
};

const clampConfidence = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const detectKeywordMatches = (text: string): { matchedTopics: string[]; matchedBotType?: BotType; matchedKeywords: string[] } => {
  const matchedTopics: string[] = [];
  const matchedKeywords: string[] = [];
  let matchedBotType: BotType | undefined;

  for (const rule of KEYWORD_RULES) {
    const hasKeyword = rule.keywords.some((word) => text.includes(word));
    if (hasKeyword) {
      matchedTopics.push(rule.topic);
      matchedKeywords.push(...rule.keywords.filter((keyword) => text.includes(keyword)));
      matchedBotType = rule.botType;
    }
  }

  return {
    matchedTopics,
    matchedBotType,
    matchedKeywords,
  };
};

export const articleProcessingService = {
  dedupe(articles: NewsArticle[]): NewsArticle[] {
    const map = new Map<string, NewsArticle>();
    for (const article of articles) {
      const key = article.url;
      const existing = map.get(key);
      if (!existing || existing.publishedAt < article.publishedAt) {
        map.set(key, article);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  },

  classify(article: NewsArticle): ArticleClassification {
    const text = [article.title, article.description, article.content]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const normalized = extractNormalizedWords(text).join(' ');

    let botType: BotType = 'news';
    let primaryTopic = article.category || 'general news';
    let classificationSource: ArticleClassification['classificationSource'] = 'default';
    let confidence = 0.45;

    if (article.category) {
      const mapped = CATEGORY_TO_BOT[article.category.toLowerCase()];
      if (mapped) {
        botType = mapped;
        classificationSource = 'category';
        primaryTopic = article.category;
        confidence += 0.25;
      }
    }

    const keywordResult = detectKeywordMatches(normalized);
    if (keywordResult.matchedBotType) {
      botType = keywordResult.matchedBotType;
      classificationSource = 'keywords';
      primaryTopic = keywordResult.matchedTopics[0] ?? primaryTopic;
      confidence = Math.max(confidence, 0.55);
    }

    const uniqueSecondary = Array.from(new Set(keywordResult.matchedTopics));
    const uniqueTags = Array.from(new Set(keywordResult.matchedKeywords));

    confidence += Math.min(uniqueSecondary.length * 0.03, 0.2);
    confidence = clampConfidence(confidence);

    return {
      botType,
      primaryTopic,
      secondaryTopics: uniqueSecondary,
      confidence,
      tags: uniqueTags,
      classificationSource,
    };
  },
};

