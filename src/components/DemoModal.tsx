import InteractiveDemo from './InteractiveDemo';

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

const DemoModal = ({ open, onClose }: DemoModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
      <div className="relative w-full max-w-6xl">
        <button
          aria-label="Close demo"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold text-textMuted transition hover:border-accent hover:text-accent"
        >
          Close
        </button>
        <div className="max-h-[90vh] overflow-y-auto rounded-[32px] border border-border bg-[#030712] p-6 shadow-2xl">
          <InteractiveDemo />
        </div>
      </div>
    </div>
  );
};

export default DemoModal;
