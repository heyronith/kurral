interface HeroProps {
  onGetStartedClick?: () => void;
}

const Hero = ({ onGetStartedClick }: HeroProps) => {
  return (
    <section id="top" className="section-container py-16 md:py-28">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-8xl font-bold leading-[1.1] text-textPrimary tracking-tight">
          Value Over{' '}
          <span className="bg-gradient-to-r from-primary via-accent to-accentSecondary bg-clip-text text-transparent">
            Virality.
          </span>
        </h1>

        {/* Subhead - Single scannable line */}
        <p className="text-lg sm:text-xl md:text-2xl text-textMuted max-w-2xl mx-auto">
          Control what you see. Trust what you read. Get recognized for quality, not clicks.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={onGetStartedClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-8 py-4 text-base font-semibold text-white transition-all duration-200 hover:from-primaryHover hover:to-accentHover shadow-button hover:shadow-buttonHover active:scale-[0.98]"
          >
            Join early access
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center text-accent font-medium transition-all duration-200 hover:text-accentHover px-6 py-4 rounded-xl hover:bg-accent/5"
          >
            See how it works
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
