export type EngagementCounts = {
  bookmarkCount?: number;
  rechirpCount?: number;
  commentCount?: number;
};

const WEIGHTS = {
  bookmark: 1,
  rechirp: 1,
  comment: 0.5,
};

const CAP_WEIGHTED_COUNT = 50;

const toNumber = (value: number | undefined): number => (Number.isFinite(value) ? value : 0);

export const getEngagementScore = (counts: EngagementCounts): number => {
  const bookmarks = toNumber(counts.bookmarkCount);
  const rechirps = toNumber(counts.rechirpCount);
  const comments = toNumber(counts.commentCount);

  const weightedSum = bookmarks * WEIGHTS.bookmark + rechirps * WEIGHTS.rechirp + comments * WEIGHTS.comment;
  if (weightedSum <= 0) {
    return 0;
  }

  const normalized = Math.log10(weightedSum + 1) / Math.log10(CAP_WEIGHTED_COUNT + 1);
  return Math.max(0, Math.min(1, normalized));
};
