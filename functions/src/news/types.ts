/**
 * News module types for GNews API and automated posting.
 */

/** GNews API article shape (from top-headlines and search endpoints). */
export interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url?: string;
  };
}

/** GNews API top-headlines response. */
export interface GNewsTopHeadlinesResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

/** Categories supported by GNews top-headlines endpoint. */
export type GNewsCategory =
  | 'general'
  | 'world'
  | 'nation'
  | 'business'
  | 'technology'
  | 'entertainment'
  | 'sports'
  | 'science'
  | 'health';

/** Configuration for the news pipeline (env + resolved IDs). */
export interface NewsConfig {
  gnewsApiKey: string;
  kuralnewsUserId: string;
  maxArticlesPerCategory: number;
  maxPostsPerPoll: number;
  /** Max age of an article in hours; older articles are skipped. */
  maxArticleAgeHours: number;
  language: string;
  country: string;
}

/** Normalized article with computed fields for dedup and posting. */
export interface NormalizedArticle {
  raw: GNewsArticle;
  articleId: string;
  publishedAt: Date;
  category: GNewsCategory;
}
