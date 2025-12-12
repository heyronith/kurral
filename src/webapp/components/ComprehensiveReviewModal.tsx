import { useState, FormEvent, useEffect } from 'react';
import { reviewContextService } from '../lib/firestore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import type { Chirp, PostReviewAction, PostReviewContext } from '../types';

interface ComprehensiveReviewModalProps {
  open: boolean;
  onClose: () => void;
  chirp: Chirp;
  onSubmitted?: () => void;
}

const ComprehensiveReviewModal = ({ open, onClose, chirp, onSubmitted }: ComprehensiveReviewModalProps) => {
  const [action, setAction] = useState<PostReviewAction | null>(null);
  const [sources, setSources] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewContexts, setReviewContexts] = useState<PostReviewContext[]>([]);
  const [loadingContexts, setLoadingContexts] = useState(false);
  const { currentUser } = useUserStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (open) {
      setAction(null);
      setSources('');
      setContext('');
      setError('');
      loadReviewContexts();
    }
  }, [open, chirp.id]);

  const loadReviewContexts = async () => {
    setLoadingContexts(true);
    try {
      const contexts = await reviewContextService.getReviewContextsForChirp(chirp.id);
      setReviewContexts(contexts);
    } catch (error) {
      console.error('[ComprehensiveReviewModal] Error loading review contexts:', error);
    } finally {
      setLoadingContexts(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('You must be logged in to submit a review');
      return;
    }

    if (!action) {
      setError('Please select whether to validate or invalidate the claim');
      return;
    }

    // Parse sources - split by newline or comma, filter empty strings
    const sourcesArray = sources
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sourcesArray.length === 0) {
      setError('Please provide at least one source URL');
      return;
    }

    // Validate URLs
    const urlPattern = /^https?:\/\/.+/i;
    const invalidUrls = sourcesArray.filter(url => !urlPattern.test(url));
    if (invalidUrls.length > 0) {
      setError(`Invalid URL(s): ${invalidUrls.join(', ')}. URLs must start with http:// or https://`);
      return;
    }

    const trimmedContext = context.trim();
    if (trimmedContext.length < 20) {
      setError('Please provide at least 20 characters of context');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await reviewContextService.createReviewContext(
        chirp.id,
        currentUser.id,
        action,
        sourcesArray,
        trimmedContext
      );
      
      // Reload review contexts
      await loadReviewContexts();
      
      // Reset form
      setAction(null);
      setSources('');
      setContext('');
      
      onSubmitted?.();
    } catch (error: any) {
      console.error('Error submitting review context:', error);
      setError(error.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const MIN_REVIEWS_REQUIRED = 50;
  const reviewCount = reviewContexts.length;
  const validateCount = reviewContexts.filter(r => r.action === 'validate').length;
  const invalidateCount = reviewContexts.filter(r => r.action === 'invalidate').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-textPrimary">Review Post</h2>
            <button
              onClick={onClose}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors text-textMuted hover:text-textPrimary ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`}
              aria-label="Close"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-textPrimary mb-1">
              This post has been marked as <strong>Needs Review</strong>. Review the fact-check results below and add your assessment.
            </p>
            <p className="text-xs text-textMuted">
              Status will be updated once {MIN_REVIEWS_REQUIRED} reviews are collected and consensus is reached. Current: {reviewCount}/{MIN_REVIEWS_REQUIRED} reviews.
            </p>
          </div>

          {/* Claims & Fact Checks */}
          {chirp.claims && chirp.claims.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-textPrimary mb-3">Claims & Verification</h3>
              <div className="space-y-3">
                {chirp.claims.map((claim) => {
                  const factCheck = chirp.factChecks?.find((fc) => fc.claimId === claim.id);
                  return (
                    <div
                      key={claim.id}
                      className="p-4 bg-backgroundElevated/40 rounded-lg border border-border/50"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm text-textPrimary flex-1">{claim.text}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50">
                            {claim.type}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50">
                            {claim.domain}
                          </span>
                        </div>
                      </div>
                      {factCheck && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                factCheck.verdict === 'true'
                                  ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                  : factCheck.verdict === 'false'
                                  ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                                  : factCheck.verdict === 'mixed'
                                  ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                                  : 'bg-backgroundElevated/60 text-textMuted border border-border/50'
                              }`}
                            >
                              {factCheck.verdict.toUpperCase()}
                            </span>
                            <span className="text-xs text-textMuted">
                              {(factCheck.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          {factCheck.evidence && factCheck.evidence.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-semibold text-textPrimary mb-1">Evidence:</p>
                              {factCheck.evidence.map((evidence, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-textMuted bg-background/50 p-2 rounded border border-border/30"
                                >
                                  <div className="font-medium text-textSecondary mb-1">{evidence.source}</div>
                                  <div className="text-textMuted mb-1">{evidence.snippet}</div>
                                  {evidence.url && (
                                    <a
                                      href={evidence.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      View source →
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {factCheck.caveats && factCheck.caveats.length > 0 && (
                            <div className="mt-2 text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                              <strong>Note:</strong> {factCheck.caveats.join(' ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Existing Reviews */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-textPrimary mb-3">
              Existing Reviews ({reviewCount}/{MIN_REVIEWS_REQUIRED} required)
            </h3>
            {loadingContexts ? (
              <div className="text-sm text-textMuted text-center py-4">Loading reviews...</div>
            ) : reviewContexts.length > 0 ? (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {reviewContexts.map((review) => (
                  <div
                    key={review.id}
                    className={`p-3 rounded-lg border ${
                      review.action === 'validate'
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`}>
                        {review.action === 'validate' ? '✓' : '✗'}
                      </span>
                      <span className={`text-xs font-semibold ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`}>
                        {review.action === 'validate' ? 'Validated' : 'Invalidated'}
                      </span>
                      <span className="text-xs text-textMuted">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.sources && review.sources.length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs font-semibold text-textPrimary mb-1">Sources:</p>
                        <ul className="space-y-0.5">
                          {review.sources.slice(0, 2).map((source, idx) => (
                            <li key={idx}>
                              <a
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline break-all"
                              >
                                {source}
                              </a>
                            </li>
                          ))}
                          {review.sources.length > 2 && (
                            <li className="text-xs text-textMuted">+{review.sources.length - 2} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-textMuted text-center py-4">
                No reviews yet. Be the first to review this post.
              </div>
            )}
            {reviewContexts.length > 0 && (
              <div className="mt-3 text-xs text-textMuted">
                Summary: {validateCount} validate, {invalidateCount} invalidate
              </div>
            )}
          </div>

          {/* Add Context Form */}
          {currentUser && currentUser.id !== chirp.authorId && (
            <div className="border-t border-border/50 pt-6">
              <h3 className="text-sm font-semibold text-textPrimary mb-4">Add Your Review</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Action Selection */}
                <div>
                  <label className="block text-sm font-medium text-textPrimary mb-3">
                    Your assessment:
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAction('validate')}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                        action === 'validate'
                          ? 'border-green-500 bg-green-500/10 text-green-600'
                          : 'border-border bg-backgroundElevated/60 text-textPrimary hover:border-green-500/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">✓</span>
                        <span className="font-semibold text-sm">Validate Claim</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction('invalidate')}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                        action === 'invalidate'
                          ? 'border-red-500 bg-red-500/10 text-red-600'
                          : 'border-border bg-backgroundElevated/60 text-textPrimary hover:border-red-500/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">✗</span>
                        <span className="font-semibold text-sm">Invalidate Claim</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Sources Input */}
                <div>
                  <label htmlFor="sources" className="block text-sm font-medium text-textPrimary mb-2">
                    Sources * (URLs, one per line or comma-separated)
                  </label>
                  <textarea
                    id="sources"
                    value={sources}
                    onChange={(e) => setSources(e.target.value)}
                    placeholder="https://example.com/source1&#10;https://example.com/source2"
                    className="w-full px-4 py-3 bg-backgroundElevated/60 border border-border rounded-lg text-textPrimary placeholder-textMuted resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono text-sm"
                    rows={4}
                    disabled={loading}
                    required
                  />
                  <div className="mt-1 text-xs text-textMuted">
                    Provide at least one source URL supporting your assessment. URLs must start with http:// or https://
                  </div>
                </div>

                {/* Optional Context */}
                <div>
          <label htmlFor="context" className="block text-sm font-medium text-textPrimary mb-2">
                    Additional context (required, min 20 chars)
                  </label>
                  <textarea
                    id="context"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Any additional explanation or context..."
                    className="w-full px-4 py-3 bg-backgroundElevated/60 border border-border rounded-lg text-textPrimary placeholder-textMuted resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    rows={3}
                    maxLength={500}
                    disabled={loading}
                    required
                  />
                  <div className="mt-1 text-xs text-textMuted text-right">
                    {context.length}/500 characters
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-border text-textPrimary ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-backgroundElevated/60 hover:bg-backgroundElevated/80'}`}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                      action === 'validate'
                        ? 'bg-green-600 hover:bg-green-700'
                        : action === 'invalidate'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-yellow-600 hover:bg-yellow-700'
                    }`}
                    disabled={loading || !action || !sources.trim() || context.trim().length < 20}
                  >
                    {loading ? 'Submitting...' : action ? `Submit ${action === 'validate' ? 'Validation' : 'Invalidation'}` : 'Select Action'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveReviewModal;
