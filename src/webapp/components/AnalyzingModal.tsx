// Analyzing Modal - Shows interactive loading state while AI analyzes content
interface AnalyzingModalProps {
  open: boolean;
  mode?: 'suggestion' | 'posting'; // Different modes for different contexts
}

const AnalyzingModal = ({ open, mode = 'suggestion' }: AnalyzingModalProps) => {
  if (!open) return null;

  const isPosting = mode === 'posting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-background border border-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-slideUp">
        <div className="flex flex-col items-center justify-center text-center">
          {/* Animated Loading Spinner */}
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-primary/10 rounded-full"></div>
            <div className="absolute inset-2 border-4 border-transparent border-b-primary/60 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>

          {/* Analyzing Text */}
          <h3 className="text-xl font-semibold text-textPrimary mb-2">
            {isPosting ? 'Analyzing Your Post' : 'Analyzing Your Content'}
          </h3>
          
          {/* Animated Dots */}
          <p className="text-sm text-textMuted mb-4 flex items-center gap-1">
            {isPosting ? 'Understanding topics and meaning' : 'Finding the best topics and reach settings'}
            <span className="inline-flex gap-1">
              <span className="animate-pulse" style={{ animationDelay: '0s' }}>.</span>
              <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>.</span>
              <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>.</span>
            </span>
          </p>

          {/* Progress Steps (Animated) */}
          <div className="w-full space-y-2 mt-4">
            {isPosting ? (
              <>
                <div className="flex items-center gap-2 text-xs text-textMuted">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <span>Extracting semantic topics...</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-textMuted">
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <span>Identifying key entities...</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-textMuted">
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                  <span>Understanding post intent...</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-textMuted">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <span>Loading top topics...</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-textMuted">
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <span>Analyzing content relevance...</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-textMuted">
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                  <span>Optimizing reach settings...</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyzingModal;

