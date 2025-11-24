import { useState } from 'react';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  demoPlaceholder?: boolean;
}

const features: Feature[] = [
  {
    id: 'algorithm-control',
    title: '100% Algorithm Control',
    description: 'Every ranking signal is visible and adjustable. You control what you see, how it\'s ranked, and why. No black boxes. No hidden manipulation.',
    icon: '⚙️',
    demoPlaceholder: true,
  },
  {
    id: 'audience-personalization',
    title: 'Personalize Your Audience',
    description: 'Define exactly who sees your content. Target by interests, expertise, location, or create custom audience segments. Reach the right people, not just the most.',
    icon: '🎯',
    demoPlaceholder: true,
  },
  {
    id: 'value-system',
    title: 'Value-Based Monetization',
    description: 'Creators earn based on the value their content creates, not views or impressions. Transparent metrics show real impact: engagement quality, knowledge shared, conversations started.',
    icon: '💎',
    demoPlaceholder: true,
  },
  {
    id: 'fact-checking',
    title: 'Real-Time Fact-Checking',
    description: 'Sophisticated AI algorithms verify claims instantly. Authentic content rises. Misinformation is flagged before it spreads. Stay at the forefront of truth.',
    icon: '✅',
    demoPlaceholder: true,
  },
];

const FeaturesSection = () => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  return (
    <section id="features" className="section-container py-20 md:py-32">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-textPrimary">
            What makes Kurral different
          </h2>
          <p className="text-lg md:text-xl text-textMuted">
            Four core innovations that put you in control and keep content authentic
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="card-surface p-8 space-y-4 cursor-pointer group"
              onMouseEnter={() => setActiveFeature(feature.id)}
              onMouseLeave={() => setActiveFeature(null)}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{feature.icon}</div>
                <div className="flex-1 space-y-3">
                  <h3 className="text-2xl font-semibold text-textPrimary group-hover:text-accent transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-textMuted leading-relaxed">
                    {feature.description}
                  </p>
                  {feature.demoPlaceholder && (
                    <div className="pt-4 border-t border-border/60">
                      <div className="rounded-lg bg-background/60 border border-border/40 p-12 text-center">
                        <div className="text-3xl mb-2">📹</div>
                        <p className="text-sm text-textMuted">Demo placeholder</p>
                        <p className="text-xs text-textLabel mt-1">Interactive demo coming soon</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

