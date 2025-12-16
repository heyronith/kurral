import { useState, FormEvent } from 'react';
import { authService } from '../lib/auth';
import { useNavigate, Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await authService.sendPasswordResetEmail(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-accent/5 to-backgroundSubtle p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 flex flex-col h-full">
          <Link to="/" className="inline-flex items-center gap-2 mb-16 group">
            <span className="text-xl font-bold text-textPrimary">Kural</span>
            <img 
              src="/quotation-marks.png" 
              alt="Kural" 
              className="h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity"
            />
          </Link>

          <div className="flex-1 flex flex-col justify-center max-w-md">
            <div className="mb-8">
              <h1 className="text-5xl font-bold text-textPrimary mb-6 leading-[1.1]">
                Reset your<br />
                <span className="bg-gradient-to-r from-primary via-accent to-accentSecondary bg-clip-text text-transparent">password.</span>
              </h1>
              <p className="text-xl text-textSecondary leading-relaxed font-medium">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="text-xl font-bold text-textPrimary">Kural</span>
              <img 
                src="/quotation-marks.png" 
                alt="Kural" 
                className="h-6 w-auto"
              />
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-textPrimary mb-3">Reset password</h2>
            <p className="text-base text-textMuted">Enter your email to receive a password reset link</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-accent/10 border-2 border-accent/30 rounded-xl text-accent text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="mb-6 p-4 bg-primary/10 border-2 border-primary/30 rounded-xl text-primary text-sm">
              <p className="font-semibold mb-2">Password reset email sent!</p>
              <p>Check your inbox for a password reset link. If you don't see it, check your spam folder.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 mb-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-textLabel mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-backgroundElevated border-2 border-border rounded-xl text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="your@email.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:from-primaryHover hover:to-accentHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-button hover:shadow-buttonHover active:scale-[0.98]"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-textMuted">
            Remember your password?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary font-semibold hover:text-primaryHover transition-colors"
            >
              Sign in
            </button>
          </p>

          <p className="text-center text-xs text-textMuted mt-4">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary font-semibold hover:text-primaryHover transition-colors"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

