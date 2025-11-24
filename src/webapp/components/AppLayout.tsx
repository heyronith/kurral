import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../lib/auth';
import LeftSidebar from './LeftSidebar';
import RightPanel from './RightPanel';
import Composer from './Composer';
import { useComposer } from '../context/ComposerContext';

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
  const location = useLocation();
  const { isComposerVisible, hideComposer } = useComposer();
  const showComposer = location.pathname === '/app' && isComposerVisible;

  // Hide composer when navigating away from /app
  useEffect(() => {
    if (location.pathname !== '/app') {
      hideComposer();
    }
  }, [location.pathname, hideComposer]);

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-textPrimary flex flex-col">
      {/* Top Bar - Full width header covering entire page */}
      <header className="sticky top-0 z-40 border-b-2 border-border/60 bg-background/95 backdrop-blur-lg py-4 px-6 shadow-elevated w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-textPrimary tracking-tight">Kurral</h1>
            <img 
              src="/quotation-marks.png" 
              alt="Kurral" 
              className="h-6 w-auto md:h-7"
            />
          </div>

          {/* Top Bar Actions */}
          <div className="flex items-center gap-3">
            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="hidden sm:block text-sm font-medium text-textMuted hover:text-accent transition-all duration-200 px-3 py-1.5 rounded-lg hover:bg-backgroundElevated/60 active:scale-95"
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
              <section className="flex-1 min-w-0 rounded-2xl border-2 border-border/60 bg-card/50 shadow-card backdrop-blur-md overflow-hidden transition-all duration-300 hover:shadow-cardHover">
                {/* Page Title */}
                {pageTitle && (
                  <div className="px-6 pt-6 pb-4 border-b-2 border-border/60 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-textPrimary">{pageTitle}</h2>
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
                    <h2 className="text-2xl font-bold text-textPrimary">{pageTitle}</h2>
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

      {/* Floating Composer - Fixed to viewport, only on feed page */}
      {showComposer && <Composer />}
    </div>
  );
};

export default AppLayout;

