const tips = [
  { id: 1, title: 'For You feed', description: 'Personalized by what you told us you care about.' },
  { id: 2, title: 'Latest feed', description: 'Chronological posts from people you follow.' },
  {
    id: 3,
    title: 'See why this appeared',
    description: 'Every card explains why it showed up so you stay in control.',
  },
];

const FirstTimeTooltips = () => {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {tips.map((tip) => (
        <div
          key={tip.id}
          className="max-w-xs rounded-2xl border border-border bg-backgroundElevated/80 p-3 text-sm leading-relaxed shadow-lg backdrop-blur"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">{tip.title}</p>
          <p className="text-[13px] text-textPrimary">{tip.description}</p>
        </div>
      ))}
    </div>
  );
};

export default FirstTimeTooltips;

