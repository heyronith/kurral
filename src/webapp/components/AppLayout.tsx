import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../lib/auth';
import LeftSidebar from './LeftSidebar';
import RightPanel from './RightPanel';
import Composer from './Composer';
import { useComposer } from '../context/ComposerContext';
import { useThemeStore } from '../store/useThemeStore';
import { MoonIcon, SunIcon } from './Icon';

interface AppLayoutProps {
  children: ReactNode;
  pageTitle?: string; // Page title shown in main content area
  pageTitleRight?: ReactNode; // Content to show on the right side of page title (e.g., navigation tabs)
  wrapContent?: boolean; // Whether to wrap children in a styled section
}

const AppLayout = ({ 
  children, 
  pageTitle,
  pageTitleRight,
  wrapContent = true 
}: AppLayoutProps) => {
  const navigate = useNavigate();
  const { isComposerVisible } = useComposer();
  const { theme, toggleTheme } = useThemeStore();

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={`min-h-screen text-textPrimary flex flex-col ${theme === 'dark' ? 'bg-black' : 'bg-background'}`}>
      {/* Top Bar - Full width header covering entire page */}
      <header className={`sticky top-0 z-40 border-b-2 border-border/60 backdrop-blur-lg py-4 px-6 shadow-elevated w-full ${theme === 'dark' ? 'bg-black/95' : 'bg-background/95'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-textPrimary tracking-tight">Kurral</h1>
            <img 
              src={theme === 'dark' ? '/right-quotation-mark.png' : '/quotation-marks.png'} 
              alt="Kurral" 
              className="h-6 w-auto md:h-7"
            />
          </div>

          {/* Top Bar Actions */}
          <div className="flex items-center gap-3">
            {/* Dark theme toggle */}
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-center w-9 h-9 rounded-lg text-textMuted hover:text-accent transition-all duration-200 ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'} active:scale-95`}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <SunIcon size={20} />
              ) : (
                <MoonIcon size={20} />
              )}
            </button>
            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className={`hidden sm:block text-sm font-medium text-textMuted hover:text-accent transition-all duration-200 px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'} active:scale-95`}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content Area with Sidebar and Main */}
      <div className="flex flex-1 relative">
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:ml-64">
          {/* Main Content */}
          <main className="flex-1 flex gap-6 px-4 py-6 max-w-[1600px] mx-auto w-full">
            {/* Main Content Area */}
        {wrapContent ? (
              <section className={`flex-1 min-w-0 rounded-2xl border-2 ${theme === 'dark' ? 'border-white/20 bg-transparent' : 'border-border/60 bg-card/50 shadow-card backdrop-blur-md'} overflow-hidden transition-all duration-300 ${theme === 'dark' ? '' : 'hover:shadow-cardHover'}`}>
                {/* Page Title */}
                {pageTitle && (
                  <div className={`px-6 pt-6 pb-4 border-b-2 ${theme === 'dark' ? 'border-white/20' : 'border-border/60'} flex items-center justify-between`}>
                    <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{pageTitle}</h2>
                    {pageTitleRight && (
                      <div className="flex items-center">
                        {pageTitleRight}
                      </div>
                    )}
                  </div>
                )}
            {children}
          </section>
        ) : (
              <div className="flex-1 min-w-0">
                {/* Page Title */}
                {pageTitle && (
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{pageTitle}</h2>
                    {pageTitleRight && (
                      <div className="flex items-center">
                        {pageTitleRight}
                      </div>
                    )}
                  </div>
                )}
            {children}
          </div>
        )}

        {/* Right Panel - Always visible */}
        <RightPanel />
      </main>
        </div>
      </div>

      {/* Floating Composer - Fixed to viewport, available on all pages */}
      {isComposerVisible && <Composer />}
    </div>
  );
};

export default AppLayout;

