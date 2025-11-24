interface IntegrityPrincipleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const IntegrityPrincipleModal = ({ isOpen, onClose }: IntegrityPrincipleModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl border border-border/60 shadow-elevated">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-border/60 bg-background/95 backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
              <svg
                viewBox="0 0 24 24"
                width={24}
                height={24}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-textPrimary">Our Integrity Principle</h2>
              <p className="text-sm text-textMuted">Truth over clicks. Quality over quantity.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60 transition-colors"
            aria-label="Close"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Simple Statement */}
          <section className="space-y-3">
            <p className="text-base text-textPrimary leading-relaxed">
              We reward <strong>valuable content</strong>, not viral content. Every post is fact-checked, scored for quality, and you're rewarded based on the value you contribute.
            </p>
          </section>

          {/* How It Works */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-textPrimary">How It Works</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-backgroundElevated/40 border border-border/50">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">✓</span>
                  <div>
                    <h4 className="text-sm font-semibold text-textPrimary mb-1">Auto Fact-Checking</h4>
                    <p className="text-xs text-textSecondary">
                      Claims are verified with web sources. You see the status and evidence.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-backgroundElevated/40 border border-border/50">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">⭐</span>
                  <div>
                    <h4 className="text-sm font-semibold text-textPrimary mb-1">Value Scoring</h4>
                    <p className="text-xs text-textSecondary">
                      Posts are scored on truth, insight, usefulness, and discussion quality. Higher scores = better rewards.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-backgroundElevated/40 border border-border/50">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">💬</span>
                  <div>
                    <h4 className="text-sm font-semibold text-textPrimary mb-1">Quality Comments</h4>
                    <p className="text-xs text-textSecondary">
                      Thoughtful comments boost your reputation and the post's value score.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* What You See */}
          <section className="pt-4 border-t border-border/60">
            <h3 className="text-sm font-bold text-textPrimary mb-4">What You'll See</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-backgroundElevated/40 border border-border/50">
                <div className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg border border-accent/20 text-xs font-semibold flex-shrink-0">
                  ⭐ 85
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-textPrimary">Value Score</div>
                  <div className="text-[10px] text-textMuted">Post quality (0-100)</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-backgroundElevated/40 border border-border/50">
                <div className="px-3 py-1.5 bg-green-500/10 text-green-600 rounded-lg border border-green-500/20 text-xs font-semibold flex-shrink-0">
                  ✓ Verified
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-textPrimary">Fact-Check Status</div>
                  <div className="text-[10px] text-textMuted">Verified • Needs Review • Blocked</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-backgroundElevated/40 border border-border/50">
                <div className="px-3 py-1.5 bg-backgroundElevated/60 text-textMuted rounded-lg border border-border/50 text-xs flex-shrink-0">
                  📋 3 claims
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-textPrimary">Claims Extracted</div>
                  <div className="text-[10px] text-textMuted">Number of facts verified</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 border-t border-border/60 bg-background/95 backdrop-blur-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg bg-accent text-white font-semibold hover:bg-accentHover transition-colors shadow-button active:scale-95"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrityPrincipleModal;
