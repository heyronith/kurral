import { useState, useEffect } from 'react';
import { reviewContextService } from '../lib/firestore';
import ReviewContextModal from './ReviewContextModal';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import type { Chirp, PostReviewContext } from '../types';

interface FactCheckStatusPopupProps {
  open: boolean;
  onClose: () => void;
  chirp: Chirp;
  onChirpUpdated?: (chirp: Chirp) => void;
}

const FactCheckStatusPopup = ({ open, onClose, chirp, onChirpUpdated }: FactCheckStatusPopupProps) => {
  const [reviewContexts, setReviewContexts] = useState<PostReviewContext[]>([]);
  const [loadingContexts, setLoadingContexts] = useState(false);
  const [showReviewContextModal, setShowReviewContextModal] = useState(false);
  const { currentUser } = useUserStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (open && chirp) {
      loadReviewContexts();
    }
  }, [open, chirp]);

  const loadReviewContexts = async () => {
    setLoadingContexts(true);
    try {
      const contexts = await reviewContextService.getReviewContextsForChirp(chirp.id);
      setReviewContexts(contexts);
    } catch (error) {
      console.error('[FactCheckStatusPopup] Error loading review contexts:', error);
    } finally {
      setLoadingContexts(false);
    }
  };

  if (!open) return null;

  const getStatusInfo = () => {
    switch (chirp.factCheckStatus) {
      case 'clean':
        return {
          icon: '✓',
          label: 'Verified',
          color: 'text-green-600',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
        };
      case 'needs_review':
        return {
          icon: '⚠',
          label: 'Needs Review',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
        };
      case 'blocked':
        return {
          icon: '✗',
          label: 'Blocked',
          color: 'text-red-600',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20',
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-background rounded-2xl border border-border shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${statusInfo.bgColor} ${statusInfo.borderColor} border-2 flex items-center justify-center text-xl`}>
                {statusInfo.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-textPrimary">Fact-Check Status</h2>
                <p className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</p>
              </div>
            </div>
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

          {/* Decision Summary - Prominent Section */}
          {chirp.factCheckStatus && (
            <div className="mb-6 p-4 rounded-lg border-2" style={{
              backgroundColor: chirp.factCheckStatus === 'blocked' 
                ? 'rgba(239, 68, 68, 0.1)' 
                : chirp.factCheckStatus === 'needs_review'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(16, 185, 129, 0.1)',
              borderColor: chirp.factCheckStatus === 'blocked'
                ? 'rgba(239, 68, 68, 0.3)'
                : chirp.factCheckStatus === 'needs_review'
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(16, 185, 129, 0.3)',
            }}>
              <h3 className="text-base font-bold text-textPrimary mb-2">Why {statusInfo.label}?</h3>
              {chirp.factChecks && chirp.factChecks.length > 0 ? (
                <div className="space-y-2">
                  {chirp.factChecks.map((fc, idx) => {
                    const claim = chirp.claims?.find(c => c.id === fc.claimId);
                    return (
                      <div key={idx} className="text-sm text-textPrimary">
                        <p className="font-semibold mb-1">
                          Claim: "{claim?.text || 'Unknown claim'}"
                        </p>
                        <p className="text-textSecondary">
                          Verdict: <span className="font-semibold">{fc.verdict.toUpperCase()}</span> 
                          {' '}({(fc.confidence * 100).toFixed(0)}% confidence)
                          {fc.evidence && fc.evidence.length > 0 && (
                            <span className="ml-2 text-xs">
                              • {fc.evidence.length} source{fc.evidence.length !== 1 ? 's' : ''} cited
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-textSecondary">
                  {chirp.factCheckStatus === 'blocked' 
                    ? 'This post contains false or misleading claims that were verified as incorrect.'
                    : chirp.factCheckStatus === 'needs_review'
                    ? 'This post requires additional review by human experts.'
                    : 'This post has been verified and contains accurate information.'}
                </p>
              )}
            </div>
          )}

          {/* Claims & Fact Checks - Detailed View */}
          {chirp.claims && chirp.claims.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-textPrimary mb-3">Detailed Evidence</h3>
              <div className="space-y-4">
                {chirp.claims.map((claim) => {
                  const factCheck = chirp.factChecks?.find((fc) => fc.claimId === claim.id);
                  return (
                    <div
                      key={claim.id}
                      className="p-4 bg-backgroundElevated/40 rounded-lg border border-border/50"
                    >
                      {/* Claim Header */}
                      <div className="mb-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-textPrimary flex-1 leading-relaxed">
                            "{claim.text}"
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50">
                            {claim.type}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50">
                            {claim.domain}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50">
                            Risk: {claim.riskLevel}
                          </span>
                        </div>
                      </div>

                      {/* Fact Check Result */}
                      {factCheck ? (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <div className="flex items-center gap-3 mb-4">
                            <span
                              className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                                factCheck.verdict === 'true'
                                  ? 'bg-green-500/20 text-green-700 border-2 border-green-500/40'
                                  : factCheck.verdict === 'false'
                                  ? 'bg-red-500/20 text-red-700 border-2 border-red-500/40'
                                  : factCheck.verdict === 'mixed'
                                  ? 'bg-yellow-500/20 text-yellow-700 border-2 border-yellow-500/40'
                                  : 'bg-backgroundElevated/60 text-textMuted border-2 border-border/50'
                              }`}
                            >
                              {factCheck.verdict.toUpperCase()}
                            </span>
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-textPrimary">
                                Confidence: {(factCheck.confidence * 100).toFixed(0)}%
                              </div>
                              <div className="text-xs text-textMuted">
                                {factCheck.checkedAt && `Checked on ${new Date(factCheck.checkedAt).toLocaleDateString()}`}
                              </div>
                            </div>
                          </div>

                          {/* Evidence Section - Prominent */}
                          {factCheck.evidence && factCheck.evidence.length > 0 ? (
                            <div className="mt-4">
                              <h4 className="text-sm font-bold text-textPrimary mb-3 flex items-center gap-2">
                                <span>📚</span>
                                Evidence Sources ({factCheck.evidence.length})
                              </h4>
                              <div className="space-y-3">
                                {factCheck.evidence.map((evidence, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3 bg-background/60 rounded-lg border border-border/40 hover:border-primary/40 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex-1">
                                        <div className="font-semibold text-sm text-textPrimary mb-1">
                                          {evidence.source}
                                        </div>
                                        {evidence.quality && (
                                          <div className="text-xs text-textMuted mb-2">
                                            Source Quality: {(evidence.quality * 100).toFixed(0)}%
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-sm text-textSecondary mb-3 leading-relaxed">
                                      "{evidence.snippet}"
                                    </div>
                                    {evidence.url && (
                                      <a
                                        href={evidence.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 hover:underline transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        View Full Source
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 p-3 bg-backgroundElevated/40 rounded-lg border border-border/30">
                              <p className="text-sm text-textMuted">
                                No evidence sources were found for this claim.
                              </p>
                            </div>
                          )}

                          {/* Caveats */}
                          {factCheck.caveats && factCheck.caveats.length > 0 && (
                            <div className="mt-4 p-3 text-sm text-yellow-700 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                              <div className="font-semibold mb-1">⚠️ Important Notes:</div>
                              <ul className="list-disc list-inside space-y-1">
                                {factCheck.caveats.map((caveat, idx) => (
                                  <li key={idx} className="text-xs">{caveat}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <p className="text-sm text-textMuted italic">
                            This claim has not been fact-checked yet.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Context Button - for needs_review posts */}
          {chirp.factCheckStatus === 'needs_review' && currentUser && currentUser.id !== chirp.authorId && (
            <div className="mb-6 pb-6 border-b border-border/50">
              <button
                onClick={() => {
                  setShowReviewContextModal(true);
                }}
                className="w-full px-4 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-colors text-sm font-medium"
              >
                Add Context for Review
              </button>
            </div>
          )}

          {/* Review Contexts */}
          {loadingContexts ? (
            <div className="text-sm text-textMuted text-center py-4">Loading review contexts...</div>
          ) : reviewContexts.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-textPrimary mb-3">User Reviews</h3>
              <div className="space-y-3">
                {reviewContexts.map((review) => (
                  <div
                    key={review.id}
                    className={`p-4 rounded-lg border ${
                      review.action === 'validate'
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`}>
                        {review.action === 'validate' ? '✓' : '✗'}
                      </span>
                      <span className={`text-sm font-semibold ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`}>
                        {review.action === 'validate' ? 'Validated' : 'Invalidated'}
                      </span>
                      <span className="text-xs text-textMuted">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.sources && review.sources.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-textPrimary mb-1">Sources:</p>
                        <ul className="space-y-1">
                          {review.sources.map((source, idx) => (
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
                        </ul>
                      </div>
                    )}
                    {review.context && (
                      <div className="mt-2 text-xs text-textMuted">
                        <p className="font-semibold text-textPrimary mb-1">Context:</p>
                        <p>{review.context}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!chirp.claims || chirp.claims.length === 0 ? (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-textPrimary mb-3">Evidence</h3>
              <div className="text-sm text-textMuted text-center py-4">
                {chirp.factCheckingStatus === 'in_progress' || chirp.factCheckingStatus === 'pending'
                  ? 'Fact-checking is still in progress. Evidence will appear here once processing is complete.'
                  : chirp.factCheckStatus
                  ? `Evidence details are not available yet. This post has been marked as ${
                      chirp.factCheckStatus === 'blocked' ? 'blocked' : 
                      chirp.factCheckStatus === 'needs_review' ? 'needing review' : 'verified'
                    } but the detailed claims and evidence have not been loaded.`
                  : 'No claims have been extracted from this post yet.'}
              </div>
            </div>
          ) : null}

          {/* Value Score Section */}
          {chirp.valueScore && (
            <div className="mb-6 pb-6 border-b border-border/50">
              <h3 className="text-sm font-semibold text-textPrimary mb-3">Value Score</h3>
              <div className="p-4 bg-backgroundElevated/40 rounded-lg border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-2xl">⭐</div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-textPrimary">
                      {(chirp.valueScore.total * 100).toFixed(0)}
                    </div>
                    <div className="text-xs text-textMuted">Overall Value Score</div>
                  </div>
                  {chirp.valueScore.confidence && (
                    <div className="text-right">
                      <div className="text-sm font-semibold text-textPrimary">
                        {(chirp.valueScore.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-textMuted">Confidence</div>
                    </div>
                  )}
                </div>
                
                {/* Value Score Breakdown */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/30">
                  <div>
                    <div className="text-xs text-textMuted mb-1">Epistemic</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.valueScore.epistemic * 100).toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-textMuted mb-1">Insight</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.valueScore.insight * 100).toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-textMuted mb-1">Practical</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.valueScore.practical * 100).toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-textMuted mb-1">Relational</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.valueScore.relational * 100).toFixed(0)}
                    </div>
                  </div>
                </div>

                {/* Value Explanation */}
                {chirp.valueExplanation && (
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <div className="text-xs font-semibold text-textPrimary mb-2">Explanation</div>
                    <p className="text-sm text-textMuted leading-relaxed">{chirp.valueExplanation}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discussion Quality Section */}
          {chirp.discussionQuality && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-textPrimary mb-3">Discussion Quality</h3>
              <div className="p-4 bg-backgroundElevated/40 rounded-lg border border-border/50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-textMuted mb-1">Informativeness</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.discussionQuality.informativeness * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-textMuted mb-1">Civility</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.discussionQuality.civility * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-textMuted mb-1">Reasoning Depth</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.discussionQuality.reasoningDepth * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-textMuted mb-1">Cross-Perspective</div>
                    <div className="text-sm font-semibold text-textPrimary">
                      {(chirp.discussionQuality.crossPerspective * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                {chirp.discussionQuality.summary && (
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <div className="text-xs font-semibold text-textPrimary mb-2">Summary</div>
                    <p className="text-sm text-textMuted leading-relaxed">{chirp.discussionQuality.summary}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Context Modal */}
      <ReviewContextModal
        open={showReviewContextModal}
        onClose={() => setShowReviewContextModal(false)}
        chirp={chirp}
        onSubmitted={async () => {
          // Reload review contexts after submission
          await loadReviewContexts();
          // Notify parent that chirp may have been updated
          onChirpUpdated?.(chirp);
        }}
      />
    </div>
  );
};

export default FactCheckStatusPopup;

