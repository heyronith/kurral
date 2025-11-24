const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="section-container border-t border-border/60 py-8 text-sm text-textMuted">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <span>© {year} Kurral</span>
        <div className="flex gap-6 text-textLabel">
          <span>Email</span>
          <span>Privacy (coming soon)</span>
          <span>X / Bluesky (coming soon)</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
