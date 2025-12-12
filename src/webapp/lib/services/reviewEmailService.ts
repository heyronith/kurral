import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

type Priority = 'high' | 'medium' | 'low';

export interface ReviewRequestEmailPayload {
  to: string;
  userName: string;
  topic: string;
  postPreview: string;
  claim?: string;
  claimType?: string;
  domain?: string;
  riskLevel?: string;
  postedAgo?: string;
  engagementSummary?: string;
  currentReviews?: number;
  totalReviews?: number;
  timeSinceMarked?: string;
  nextReviewWindowHours?: number;
  priority?: Priority;
  reviewUrl: string;
  viewPostUrl?: string;
}

const sendReviewRequestEmailFn = httpsCallable<ReviewRequestEmailPayload, { success: boolean; id?: string }>(
  functions,
  'sendReviewRequestEmail'
);

export const reviewEmailService = {
  async sendReviewRequestEmail(payload: ReviewRequestEmailPayload) {
    const result = await sendReviewRequestEmailFn(payload);
    return result.data;
  },
};
