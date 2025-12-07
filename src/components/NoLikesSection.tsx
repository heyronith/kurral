const NoLikesSection = () => {
  return (
    <section id="no-likes" className="section-container grid gap-12 py-20 lg:grid-cols-2">
      <div className="space-y-6">
        <p className="text-xs uppercase tracking-[0.3em] text-textLabel">No likes, no clout war</p>
        <h2 className="text-3xl font-semibold text-textPrimary">No public likes. No clout war.</h2>
        <p className="text-textMuted">
          On Kural, you can appreciate, comment, and repost - but we don't plaster massive like and follower
          counts under every post. Discovery happens through conversations and the one For You feed you control.
        </p>
        <ul className="list-disc space-y-3 pl-6 text-sm text-textMuted">
          <li>No public like counters screaming at you.</li>
          <li>Follower count isn't the centerpiece of your profile.</li>
          <li>Creators see their stats privately; strangers see your words, not your score.</li>
        </ul>
        <blockquote className="rounded-2xl border border-border/70 bg-background/60 p-5 text-sm text-textMuted">
          Less pressure. Less comparison. More room for short, honest thoughts - without wondering if they'll
          perform.
        </blockquote>
      </div>
      <div className="space-y-4">
        <div className="card-surface space-y-3 border-dashed border-border/50 p-5">
          <p className="text-sm font-semibold text-textMuted">Typical network</p>
          <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm text-textMuted">
            <p>@someone - 2.3K likes - 420 reposts - 98 comments</p>
            <p className="mt-2 text-textLabel">Every post graded in public.</p>
          </div>
        </div>
        <div className="card-surface space-y-4 border border-accent/40 p-6">
          <div className="flex items-center justify-between text-sm text-textMuted">
            <span>@chirper</span>
            <span>Active now</span>
          </div>
          <p className="text-base text-textPrimary">
            "Muted the like counters, boosted the conversations. Feels like a group chat that actually moves."
          </p>
          <div className="flex items-center justify-between text-xs text-textLabel">
            <span>18 people discussing this</span>
            <span className="rounded-full border border-border px-3 py-1 text-[11px] text-textMuted">
              Because: topic you boosted
            </span>
          </div>
          <p className="text-xs text-textLabel">
            Kural surfaces activity and your For You rules - not vanity metrics.
          </p>
        </div>
      </div>
    </section>
  );
};

export default NoLikesSection;
