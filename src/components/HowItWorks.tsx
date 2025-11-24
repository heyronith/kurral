interface HowItWorksProps {
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

const HowItWorks = ({ onShowDemo }: HowItWorksProps) => {
  return (
    <section id="how-it-works" className="section-container py-20 md:py-32 bg-background/50">
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-textPrimary">How it works</h2>
          <p className="text-lg md:text-xl text-textMuted">
            Four simple steps to a better social media experience
          </p>
        </div>

        <div className="space-y-12">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="grid md:grid-cols-2 gap-8 items-center"
              style={{ direction: index % 2 === 1 ? 'rtl' : 'ltr' }}
            >
              <div style={{ direction: 'ltr' }} className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-bold text-accent/20">{step.number}</span>
                  <h3 className="text-2xl md:text-3xl font-semibold text-textPrimary">
                    {step.title}
                  </h3>
            </div>
                <p className="text-lg text-textMuted leading-relaxed">
                  {step.description}
                </p>
                {step.demo && onShowDemo && (
                  <button
                    onClick={onShowDemo}
                    className="inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-accent transition hover:bg-accent/10 mt-4"
                  >
                    View demo →
                  </button>
                )}
              </div>
              <div style={{ direction: 'ltr' }} className="card-surface p-8">
                <div className="rounded-lg bg-background/60 border border-border/40 p-16 text-center">
                  <div className="text-4xl mb-4">📹</div>
                  <p className="text-sm text-textMuted font-medium">Interactive demo</p>
                  <p className="text-xs text-textLabel mt-2">See {step.title.toLowerCase()} in action</p>
            </div>
          </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
