import { useState, FormEvent, useEffect } from 'react';
import { reviewContextService } from '../lib/firestore';
import { useUserStore } from '../store/useUserStore';
import type { Chirp, PostReviewAction } from '../types';

interface ReviewContextModalProps {
  open: boolean;
  onClose: () => void;
  chirp: Chirp;
  onSubmitted?: () => void;
}

const ReviewContextModal = ({ open, onClose, chirp, onSubmitted }: ReviewContextModalProps) => {
  const [action, setAction] = useState<PostReviewAction | null>(null);
  const [sources, setSources] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useUserStore();

  useEffect(() => {
    if (open) {
      setAction(null);
      setSources('');
      setContext('');
      setError('');
    }
  }, [open]);

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

    setLoading(true);
    setError('');

    try {
      await reviewContextService.createReviewContext(
        chirp.id,
        currentUser.id,
        action,
        sourcesArray,
        context.trim() || undefined
      );
      
      // Reset form
      setAction(null);
      setSources('');
      setContext('');
      
      onSubmitted?.();
      onClose();
    } catch (error: any) {
      console.error('Error submitting review context:', error);
      setError(error.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-textPrimary">Review Post</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-backgroundElevated/60 transition-colors text-textMuted hover:text-textPrimary"
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

          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-textPrimary">
              This post has been marked as <strong>Needs Review</strong>. Help verify the claims by either validating or invalidating them with sources.
            </p>
          </div>

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
                Additional context (optional)
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
              />
              <div className="mt-1 text-xs text-textMuted text-right">
                {context.length}/500 characters
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-backgroundElevated/60 border border-border text-textPrimary hover:bg-backgroundElevated/80"
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
                disabled={loading || !action || !sources.trim()}
              >
                {loading ? 'Submitting...' : action ? `Submit ${action === 'validate' ? 'Validation' : 'Invalidation'}` : 'Select Action'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReviewContextModal;
