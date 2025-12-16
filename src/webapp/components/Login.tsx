import { useState, FormEvent } from 'react';
import { authService } from '../lib/auth';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await authService.signInWithEmail(email, password);
      // Check if onboarding is completed
      if (user.onboardingCompleted) {
        navigate('/app');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const user = await authService.signInWithGoogle();
      // Check if onboarding is completed
      if (user.onboardingCompleted) {
        navigate('/app');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
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
          <Link to="/" className="inline-flex items-center gap-2 mb-16 group hover:scale-105 transition-transform">
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
                Welcome<br />
                <span className="bg-gradient-to-r from-primary via-accent to-accentSecondary bg-clip-text text-transparent">back.</span>
              </h1>
              <p className="text-xl text-textSecondary leading-relaxed font-medium">
                Your personalized feed is waiting. Every post explained. Every recommendation transparent.
              </p>
            </div>

            <div className="space-y-4 mt-10">
              <div className="flex items-center gap-3 text-textPrimary">
                <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                <span className="text-base">Your feed tuned to your preferences</span>
              </div>
              <div className="flex items-center gap-3 text-textPrimary">
                <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                <span className="text-base">Verified content only - no viral lies</span>
              </div>
              <div className="flex items-center gap-3 text-textPrimary">
                <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                <span className="text-base">Quality content gets recognized</span>
              </div>
          </div>
        </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
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

          {/* Mobile Value Proposition */}
          <div className="lg:hidden mb-6 p-4 bg-gradient-to-br from-primary/10 via-accent/5 to-backgroundSubtle rounded-xl">
            <h2 className="text-2xl font-bold text-textPrimary mb-2">Welcome back</h2>
            <p className="text-sm text-textSecondary">Your personalized feed is waiting</p>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-textPrimary mb-3">Sign in</h2>
            <p className="text-base text-textMuted">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-accent/10 border-2 border-accent/30 rounded-xl text-accent text-sm">
              {error}
            </div>
          )}

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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-textLabel">
                Password
              </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm text-primary font-medium hover:text-primaryHover transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-backgroundElevated border-2 border-border rounded-xl text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:from-primaryHover hover:to-accentHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-button hover:shadow-buttonHover active:scale-[0.98]"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-background text-textMuted">Or</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="mt-4 w-full py-3 px-4 bg-backgroundElevated border-2 border-border text-textPrimary rounded-xl font-medium hover:bg-backgroundHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>

          <p className="text-center text-sm text-textMuted">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary font-semibold hover:text-primaryHover transition-colors"
            >
              Sign up
            </button>
          </p>

          <p className="text-center text-sm text-textMuted mt-4">
            By signing in, you agree to our{' '}
            <Link
              to="/terms"
              className="text-accent hover:text-accentHover underline font-medium"
            >
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link
              to="/privacy"
              className="text-accent hover:text-accentHover underline font-medium"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
