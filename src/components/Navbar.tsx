import { useState } from 'react';
import { Link } from 'react-router-dom';

const links = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

interface NavbarProps {
  onGetStartedClick?: () => void;
}

const Navbar = ({ onGetStartedClick }: NavbarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 py-4 backdrop-blur-lg shadow-elevated">
      <div className="section-container flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-textPrimary tracking-tight group hover:text-accent transition-colors duration-200">
          <span className="group-hover:scale-105 transition-transform">Kural</span>
          <img src="/quotation-marks.png" alt="" className="h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity" loading="eager" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm font-medium text-textMuted">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
                className="transition-all duration-200 hover:text-textPrimary"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
            onClick={onGetStartedClick}
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-primaryHover hover:to-accentHover shadow-button hover:shadow-buttonHover active:scale-[0.98]"
        >
            Join early access
        </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-textMuted hover:text-textPrimary transition-colors"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/60 bg-background/98 backdrop-blur-lg transition-all duration-300 ease-in-out">
          <nav className="section-container py-4 flex flex-col gap-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-base font-medium text-textMuted hover:text-textPrimary transition-colors"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onGetStartedClick?.();
              }}
              className="mt-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-center text-sm font-semibold text-white transition-all duration-200 hover:from-primaryHover hover:to-accentHover shadow-button hover:shadow-buttonHover active:scale-[0.98]"
            >
              Join early access
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
