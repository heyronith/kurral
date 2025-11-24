interface ValuePropositionSectionProps {
  onShowDemo?: () => void;
}

const steps = [
  {
    number: '01',
    title: 'Control Your Algorithm',
    description: 'Adjust every ranking signal in real-time. See exactly why content appears in your feed. Boost topics, mute noise, prioritize conversations—all transparent and adjustable.',
    demo: true,
  },
  {
    number: '02',
    title: 'Personalize Your Audience',
    description: 'When you post, define who should see it. Target by interests, expertise, or create custom segments. Your content reaches the right people, not just the algorithm\'s guess.',
    demo: true,
  },
  {
    number: '03',
    title: 'Earn Based on Value',
    description: 'Monetization isn\'t about views—it\'s about impact. See transparent metrics: quality engagement, knowledge shared, meaningful conversations started. Get rewarded for creating value.',
    demo: true,
  },
  {
    number: '04',
    title: 'Trust Through Verification',
    description: 'Every post is fact-checked in real-time by sophisticated AI. Authentic content rises. Misinformation is flagged. You stay informed with confidence.',
    demo: true,
  },
];

const ValuePropositionSection = ({ onShowDemo }: ValuePropositionSectionProps) => {
  return (
    <section id="how-it-works" className="section-container py-20 md:py-32">
      <div className="max-w-5xl mx-auto">
        <div className="card-surface p-12 md:p-16 space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-textPrimary">
              The future of social media is{' '}
              <span className="bg-gradient-to-r from-accent to-accentSecondary bg-clip-text text-transparent">
                transparent, controlled, and valuable
              </span>
            </h2>
            <p className="text-lg text-textMuted max-w-2xl mx-auto">
              Four simple steps to a better social media experience
            </p>
          </div>

          {/* How it works steps */}
          <div className="pt-4 space-y-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`flex flex-col md:flex-row gap-6 items-start ${
                  index < steps.length - 1 ? 'pb-8 border-b border-border/40' : ''
                }`}
              >
                <div className="flex-shrink-0 flex items-center gap-3">
                  <span className="text-3xl font-bold text-accent/30">{step.number}</span>
                  <h3 className="text-xl md:text-2xl font-semibold text-textPrimary">
                    {step.title}
                  </h3>
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-textMuted leading-relaxed">
                    {step.description}
                  </p>
                  {step.demo && onShowDemo && (
                    <button
                      onClick={onShowDemo}
                      className="inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm text-accent transition hover:bg-accent/10"
                    >
                      View demo →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ValuePropositionSection;

