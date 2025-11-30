import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <section id="top" className="section-container py-16 md:py-28">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.1] text-textPrimary tracking-tight flex items-center justify-center gap-3 sm:gap-4">
          You are the{' '}
          <span className="bg-gradient-to-r from-accent to-accentSecondary bg-clip-text text-transparent">
            algorithm.
          </span>
          <img src="/quotation-marks.png" alt="" className="h-8 sm:h-10 md:h-14 lg:h-16 w-auto" loading="eager" />
        </h1>

        {/* Subhead - Single scannable line */}
        <p className="text-lg sm:text-xl md:text-2xl text-textMuted max-w-2xl mx-auto">
          Social media without the manipulation. Control your feed, target your audience, and get paid for quality.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            to="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accentLight px-8 py-4 text-base font-semibold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-button hover:shadow-buttonHover active:scale-[0.98]"
          >
            Join the Beta
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center text-accent font-medium transition-all duration-200 hover:text-accentLight px-6 py-4 rounded-xl hover:bg-accent/5"
          >
            See how it works →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
