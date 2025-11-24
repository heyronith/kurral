import { FormEvent, useState } from 'react';

const WaitlistCTA = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section id="waitlist" className="section-container py-16">
      <div className="max-w-2xl mx-auto space-y-8 text-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold text-textPrimary">
            Join the founding community
          </h2>
          <p className="text-lg text-textMuted leading-relaxed">
            Kurral is in private beta. We're inviting people who want a minimalist social feed they control—chronological
            by default, transparent when it's ranked, and calm enough that you can be fully caught up in minutes, not
            hours. Help us prove social media doesn't need manipulation to work.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-textMuted flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent"></div>
              <span>Early access opens January 2025</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent"></div>
              <span>Limited spots available</span>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-left max-w-md mx-auto">
          <div>
            <label className="block text-sm text-textLabel mb-2">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              className="w-full border-b border-border bg-transparent py-2 text-base text-textPrimary outline-none placeholder:text-textMuted focus:border-accent"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-6 py-3 font-semibold text-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitted}
          >
            {submitted ? "✓ You're on the list" : 'Request early access'}
          </button>
          {submitted && <p className="text-sm text-textMuted text-center">Thanks. We'll email you with access details before launch.</p>}
        </form>
      </div>
    </section>
  );
};

export default WaitlistCTA;
