import { useState, FormEvent } from 'react';
import { authService } from '../lib/auth';
import { useNavigate, Link } from 'react-router-dom';

const Signup = () => {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!handle.match(/^[a-zA-Z0-9_]+$/)) {
      setError('Handle can only contain letters, numbers, and underscores');
      return;
    }

    setLoading(true);

    try {
      await authService.signUpWithEmail(email, password, name, handle);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
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
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left Side - Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-accent/5 to-backgroundSubtle p-8 flex-col justify-center relative overflow-hidden max-h-screen">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-8 group">
            <span className="text-lg font-bold text-textPrimary">Kurral</span>
            <img 
              src="/quotation-marks.png" 
              alt="Kurral" 
              className="h-5 w-auto opacity-80 group-hover:opacity-100 transition-opacity"
            />
          </Link>

            <div>
            <h1 className="text-5xl font-bold text-textPrimary mb-4 leading-tight">
              Stop fighting<br />
              <span className="bg-gradient-to-r from-primary via-accent to-accentSecondary bg-clip-text text-transparent">the feed.</span>
              </h1>
            <p className="text-lg text-textSecondary leading-snug mb-6">
              Join the platform where you control what you see, who sees your content, and how value is measured.
              </p>

            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-2.5 text-textPrimary">
                <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></div>
                <span className="text-base">Talk to your feed in plain English</span>
              </div>
              <div className="flex items-center gap-2.5 text-textPrimary">
                <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></div>
                <span className="text-base">Truth intelligence verifies every post before you see it</span>
              </div>
              <div className="flex items-center gap-2.5 text-textPrimary">
                <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></div>
                <span className="text-base">Earn from value, not vanity metrics</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
              <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-xs font-medium text-accent">No data selling • Full transparency</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-8 overflow-y-auto max-h-screen">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-6">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="text-lg font-bold text-textPrimary">Kurral</span>
              <img 
                src="/quotation-marks.png" 
                alt="Kurral" 
                className="h-5 w-auto"
              />
            </Link>
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-bold text-textPrimary mb-2">Start your journey</h2>
            <p className="text-base text-textMuted">Join thousands taking control of their social media experience</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 mb-4">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-textLabel mb-1.5">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="handle" className="block text-xs font-medium text-textLabel mb-1.5">
                Handle
              </label>
              <input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                pattern="[a-zA-Z0-9_]+"
                className="w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="username"
              />
              <p className="mt-1 text-xs text-textMuted">Only letters, numbers, and underscores</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-textLabel mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-textLabel mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-textMuted">Min. 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-textLabel mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-semibold hover:from-primaryHover hover:to-accentHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-button hover:shadow-buttonHover active:scale-[0.98] mt-1"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-background text-textMuted">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="mt-3 w-full py-2.5 px-4 bg-backgroundElevated border-2 border-border text-textPrimary rounded-lg text-sm font-medium hover:bg-backgroundHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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

          <p className="text-center text-xs text-textMuted">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary font-semibold hover:text-primaryHover transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;

