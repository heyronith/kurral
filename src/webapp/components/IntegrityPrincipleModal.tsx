import { useThemeStore } from '../store/useThemeStore';

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
  const { theme } = useThemeStore();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-black border-white/20' : 'bg-background border-border/60'} rounded-2xl border shadow-elevated`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-white/10 bg-black/95' : 'border-border/60 bg-background/95'} backdrop-blur-lg`}>
          <div>
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Our Integrity Principle</h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>How we ensure quality and truth on the platform</p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-lg ${theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60'} transition-colors`}
            aria-label="Close"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Real-Time Fact Checking */}
          <section className="space-y-3">
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Real-Time Fact Checking</h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              Every post is analyzed by Truth intelligence as soon as it's published. Claims are automatically extracted and verified using systems and human intervention when needed. The system evaluates evidence quality, cross-references multiple sources including government sites, academic institutions, and established news organizations, and provides verdicts with confidence scores.
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              Fact-checking happens instantly in real-time. Posts with false claims are automatically blocked. High-risk claims in health, finance, or politics that cannot be verified are flagged for human review. All fact-check results are visible to users with evidence citations.
            </p>
          </section>

          {/* Value Creation Priority */}
          <section className={`space-y-3 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/60'}`}>
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Value Creation Priority</h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              We prioritize value creation over engagement metrics. Every post is scored using our proprietary Kural Score system (0-100) that evaluates content quality through AI analysis.
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              Scores are calculated dynamically using our unique algorithm. Posts with higher value scores receive better visibility and creators get recognized based on the value they contribute, not views or likes. The system evaluates discussion quality, fact-check results, and community trust to determine scores.
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              High-value creators with strong Kural Scores get recognized for their impact. Scores update in real-time as new posts are published and fact-checked. In the future, we plan to introduce monetization based on this value system.
            </p>
          </section>

          {/* Policy Enforcement */}
          <section className={`space-y-3 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/60'}`}>
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Policy Enforcement</h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              Posts are automatically evaluated by our policy engine based on fact-check results. Posts with false claims verified with high confidence are immediately blocked. High-risk claims in sensitive domains that lack verification are flagged for review. All other posts are marked as clean.
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              Policy decisions are made algorithmically using AI analysis, not keyword matching or heuristics. The system considers claim risk levels, fact-check confidence scores, and domain context to make enforcement decisions. Users can see the policy status and reasons for each decision.
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'} leading-relaxed`}>
              Violations impact Kural Scores negatively. Repeated violations or severe misinformation result in score penalties that affect your credibility and reach. The system tracks violations over time with decay, allowing users to recover through consistent quality contributions.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 p-6 border-t ${theme === 'dark' ? 'border-white/10 bg-black/95' : 'border-border/60 bg-background/95'} backdrop-blur-lg`}>
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
