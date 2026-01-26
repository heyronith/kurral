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
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

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
        className="relative w-full max-w-xl max-h-[95vh] flex flex-col bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
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

        <div className="p-6 sm:p-8 md:p-10 overflow-y-auto">
          {success ? (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center rounded-full bg-green-500/20 border border-green-500/30 w-16 h-16 mb-2">
                  <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white">Welcome to Kural!</h2>
                <p className="text-white/70 text-lg">You've been added to our early access list.</p>
              </div>

              <div className="space-y-6 bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white">What happens next?</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-accent/20 border border-accent/30 w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-accent">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">Confirmation email</p>
                      <p className="text-sm text-white/60">We've reserved your spot. Watch your inbox for a confirmation!</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-accent/20 border border-accent/30 w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-accent">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">Early Access Launch</p>
                      <p className="text-sm text-white/60">You'll get an invite when we open on <span className="text-accentLight font-semibold">Jan 5, 2026</span>.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-accent/20 border border-accent/30 w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-accent">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">Lifetime Premium</p>
                      <p className="text-sm text-white/60">As a beta member, your account will be upgraded to <span className="text-accentSecondary font-semibold">lifetime premium</span> for free.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center pt-2">
                <button
                  onClick={handleClose}
                  className="px-8 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all"
                >
                  Close
                </button>
                <p className="mt-6 text-sm text-white/40">
                  Questions? Contact <span className="text-white/60">support@kurral.app</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center">
                <h2 id="beta-signup-title" className="text-3xl md:text-4xl font-bold text-white mb-3">
                  Join the Beta
                </h2>
                <p className="text-white/60 text-lg max-w-sm mx-auto">
                  Be among the first to experience social media focused on value, not virality.
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm animate-shake">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="beta-email" className="block text-sm font-medium text-white/90 mb-2 ml-1">
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
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-4 text-white placeholder-white/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
                    placeholder="your.email@example.com"
                    aria-required="true"
                  />
                </div>

                <div className="flex flex-col gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-accent to-accentLight py-4 text-lg font-bold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Joining...' : 'Get Early Access'}
                  </button>
                  <p className="text-center text-xs text-white/40">
                    By joining, you agree to our <span className="text-white/60 hover:underline cursor-pointer">Terms of Service</span> and <span className="text-white/60 hover:underline cursor-pointer">Privacy Policy</span>.
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BetaSignupModal;
