import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <section id="top" className="section-container py-20 md:py-32">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight text-textPrimary tracking-tight">
          Social media where{' '}
          <span className="bg-gradient-to-r from-accent to-accentSecondary bg-clip-text text-transparent">
            you're in control
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-textMuted max-w-3xl mx-auto leading-relaxed">
          Kurral is the first agentic social platform that gives you <strong className="text-textPrimary">100% control</strong> over your algorithm, 
          lets you <strong className="text-textPrimary">personalize your audience</strong>, rewards creators based on <strong className="text-textPrimary">value not views</strong>, 
          and uses <strong className="text-textPrimary">real-time fact-checking</strong> to keep content authentic.
          </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link
            to="/app"
            className="inline-block rounded-lg bg-gradient-to-r from-accent to-accentLight px-8 py-4 text-base font-semibold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-button hover:shadow-buttonHover active:scale-95"
          >
            Get Started
          </Link>
          <a
            href="#features"
            className="inline-block text-accent font-medium transition-all duration-200 hover:text-accentLight hover:translate-x-1 px-4 py-4"
          >
            Learn more →
          </a>
        </div>

        {/* Key differentiators - quick visual */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-3xl mx-auto">
          <div className="text-center p-4 rounded-xl border border-border/60 bg-card/40">
            <div className="text-2xl font-bold text-accent mb-1">100%</div>
            <div className="text-xs text-textMuted">Algorithm Control</div>
          </div>
          <div className="text-center p-4 rounded-xl border border-border/60 bg-card/40">
            <div className="text-2xl font-bold text-accentSecondary mb-1">AI</div>
            <div className="text-xs text-textMuted">Fact-Checking</div>
          </div>
          <div className="text-center p-4 rounded-xl border border-border/60 bg-card/40">
            <div className="text-2xl font-bold text-accent mb-1">Value</div>
            <div className="text-xs text-textMuted">Based Rewards</div>
          </div>
          <div className="text-center p-4 rounded-xl border border-border/60 bg-card/40">
            <div className="text-2xl font-bold text-accentSecondary mb-1">You</div>
            <div className="text-xs text-textMuted">Choose Audience</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
