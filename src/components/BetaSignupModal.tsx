import { useState, FormEvent, useEffect, useRef } from 'react';
import { betaSignupService } from '../webapp/lib/services/betaSignupService';

interface BetaSignupModalProps {
  open: boolean;
  onClose: () => void;
}

const BetaSignupModal = ({ open, onClose }: BetaSignupModalProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [greeting, setGreeting] = useState('Hey Friend,');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Get time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { base: 'Good morning,', friend: 'Friend,' };
    } else if (hour >= 12 && hour < 17) {
      return { base: 'Good afternoon,', friend: 'Friend,' };
    } else if (hour >= 17 && hour < 22) {
      return { base: 'Good evening,', friend: 'Friend,' };
    } else {
      return { base: 'Hey', friend: 'Friend,' };
    }
  };

  // Full message content
  const fullMessage = `We're tired of algorithms that optimize for engagement instead of value. Tired of black boxes. Tired of misinformation spreading. So we built Kural - social media that rewards quality, not clickbait.

Every post gets a Kural Score. Quality content? Your score rises. Misinformation? You get penalized. Future monetization is based on value, not clicks.

You control your feed in plain English. No black boxes. Just social media that works for you.

Early access opens Jan 5, 2026. You'll be one of a few thousand shaping value-driven social media. Join the beta and get lifetime premium access, forever free.

With Love,
Kural Team`;

  // Render text with highlights
  const renderTextWithHighlights = (text: string) => {
    // Split by highlights and signature
    const parts = text.split(/(Jan 5, 2026|lifetime premium access, forever free|With Love,|Kural Team)/);
    return parts.map((part, index) => {
      if (part === 'Jan 5, 2026') {
        return <span key={index} className="font-semibold text-accentLight">{part}</span>;
      } else if (part === 'lifetime premium access, forever free') {
        return <span key={index} className="font-semibold text-accentSecondary">{part}</span>;
      } else if (part === 'With Love,' || part === 'Kural Team') {
        return <span key={index} className="italic text-white/85">{part}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Update greeting and start typewriter when modal opens
  useEffect(() => {
    if (open && !success) {
      setGreeting(getTimeBasedGreeting().base);
      setDisplayedText('');
      setIsTyping(true);
      
      let currentIndex = 0;
      const typeInterval = setInterval(() => {
        if (currentIndex < fullMessage.length) {
          setDisplayedText(fullMessage.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(typeInterval);
        }
      }, 20); // Adjust speed here (lower = faster)

      return () => clearInterval(typeInterval);
    } else if (!open) {
      setDisplayedText('');
      setIsTyping(false);
    }
  }, [open, success]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, loading, onClose]);

  // Focus email input when modal opens
  useEffect(() => {
    if (open && emailInputRef.current && !success) {
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [open, success]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await betaSignupService.submitBetaSignup(email);
      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-signup-title"
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-5xl max-h-[95vh] flex flex-col md:flex-row bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          aria-label="Close beta signup"
          onClick={handleClose}
          disabled={loading}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm w-8 h-8 flex items-center justify-center text-white transition hover:border-white/30 hover:bg-white/20 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Personal Message Section - Left Side */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10 bg-[#030712] min-h-[400px] md:min-h-[500px]">
          {success ? (
            <div className="space-y-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full bg-green-500/20 border border-green-500/30 w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 to-accent bg-clip-text text-transparent">
                  You're on the list!
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">What happens next?</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-accent/20 border border-accent/30 w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-accent">1</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white mb-1">You're on the list</p>
                        <p className="text-sm text-white/70">We've added you to the beta waitlist. You're all set!</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-accent/20 border border-accent/30 w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-accent">2</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white mb-1">Wait for launch</p>
                        <p className="text-sm text-white/70">We'll send you an invite when early access opens on <span className="font-semibold text-accentLight">Jan 5, 2026</span>.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-accent/20 border border-accent/30 w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-accent">3</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white mb-1">Get lifetime premium</p>
                        <p className="text-sm text-white/70">As a beta member, you'll receive <span className="font-semibold text-accentSecondary">lifetime premium access</span> at no cost.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm text-white/80">
                    Questions? Reach out to us at <span className="font-semibold text-accentLight">support@kurral.app</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-white leading-relaxed min-h-[350px] md:min-h-[450px] flex flex-col">
              <p className="text-base md:text-lg mb-3">
                {greeting} <span className="bg-gradient-to-r from-accent to-accentSecondary bg-clip-text text-transparent font-semibold">{getTimeBasedGreeting().friend}</span>
              </p>
              
              <div className="text-sm md:text-base text-white/95 whitespace-pre-wrap flex-1">
                {renderTextWithHighlights(displayedText)}
                {isTyping && (
                  <span className="inline-block w-0.5 h-4 bg-accent ml-1 animate-pulse" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form Section - Right Side */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[95vh] flex flex-col justify-center">
          {success ? (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-green-500/20 border border-green-500/30 w-20 h-20 flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Welcome to Kural!</h3>
              <p className="text-white/80 text-base leading-relaxed max-w-sm">
                Your email has been confirmed. Check the left side to see what happens next.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 id="beta-signup-title" className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Join the Beta
                </h2>
                <p className="text-white/60 text-sm">Enter your email to get early access</p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Email - Required */}
              <div>
                <label htmlFor="beta-email" className="block text-sm font-medium text-white/90 mb-2">
                  Email Address
                </label>
                <input
                  ref={emailInputRef}
                  type="email"
                  id="beta-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
                  placeholder="your.email@example.com"
                  aria-required="true"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-gradient-to-r from-accent to-accentLight px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-button hover:shadow-buttonHover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Join Beta'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default BetaSignupModal;
