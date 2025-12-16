import { useState } from 'react';
import { Link } from 'react-router-dom';
import ContactModal from './ContactModal';

const Footer = () => {
  const year = new Date().getFullYear();
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <>
      <footer className="section-container border-t border-border/40 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-textMuted">
          <span>© {year} Kural</span>
          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="hover:text-textPrimary transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className="hover:text-textPrimary transition-colors"
            >
              Privacy
            </Link>
            <button
              onClick={() => setContactModalOpen(true)}
              className="hover:text-textPrimary transition-colors"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>
      <ContactModal open={contactModalOpen} onClose={() => setContactModalOpen(false)} />
    </>
  );
};

export default Footer;
