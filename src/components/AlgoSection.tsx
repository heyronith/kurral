import { useMemo, useState } from 'react';

type Mix = 'mostly-following' | 'mixed' | 'mostly-everyone';

const mixOptions: { id: Mix; label: string; description: string }[] = [
  {
    id: 'mostly-following',
    label: 'Mostly Following',
    description: 'Lean into people you already follow.',
  },
  {
    id: 'mixed',
    label: 'Mixed',
    description: 'Blend Following with Everyone.',
  },
  {
    id: 'mostly-everyone',
    label: 'Mostly Everyone',
    description: 'See more from the wider network.',
  },
];

const topicOptions = ['dev', 'startups', 'music', 'sports'];
const mutedOptions = ['politics', 'crypto'];

const AlgoSection = () => {
  const [mix, setMix] = useState<Mix>('mixed');
  const [boostPeople, setBoostPeople] = useState(true);
  const [boostActive, setBoostActive] = useState(true);
  const [topics, setTopics] = useState(new Set(['dev', 'startups']));
  const [muted, setMuted] = useState(new Set(['politics']));

  const summary = useMemo(() => {
    const mixLabel = mix.split('-').join(' ');
    const parts: string[] = [
      `Your For You feed is currently ${mixLabel}`,
      boostPeople ? 'boosting people you talk to' : '',
      boostActive ? 'prioritizing active conversations' : '',
    ].filter(Boolean);

    const topicList = Array.from(topics).map((topic) => `#${topic}`).join(', ');
    const mutedList = Array.from(muted).map((topic) => `#${topic}`).join(', ');

    if (topicList) parts.push(`showing ${topicList}`);
    if (mutedList) parts.push(`muting ${mutedList}`);

    return `${parts.join(', ')}.`;
  }, [boostActive, boostPeople, mix, muted, topics]);

  const toggleTopic = (topic: string, collection: Set<string>, setter: (set: Set<string>) => void) => {
    const next = new Set(collection);
    if (next.has(topic)) {
      next.delete(topic);
    } else {
      next.add(topic);
    }
    setter(next);
  };

  return (
    <section id="algorithm" className="section-container grid gap-12 py-20 lg:grid-cols-2">
      <div className="space-y-6">
        <p className="text-xs uppercase tracking-[0.3em] text-textLabel">The algorithm</p>
        <h2 className="text-3xl font-semibold text-textPrimary">The Algorithm (For You, not for us)</h2>
        <p className="text-textMuted">
          Kural doesn't run a giant AI to guess what will hook you. Latest stays chronological. For You is the
          only ranked feed - and you can see, tweak, and trust every rule that powers it.
        </p>
        <ul className="list-disc space-y-3 pl-6 text-sm text-textMuted">
          <li>Signals are simple: Following, Everyone, tags you care about, and active conversations.</li>
          <li>No long posts to boost - every post is short, so we focus on what it's about and who it's from.</li>
          <li>Every ranked post carries a tiny "because…" chip so you always know why it showed up.</li>
        </ul>
      </div>
      <div className="card-surface space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-textPrimary">For You controls</p>
            <span className="text-xs text-textLabel">Live preview</span>
          </div>
          <div className="flex gap-2">
            {mixOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setMix(option.id)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  mix === option.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-textMuted hover:border-accent/40 hover:text-textPrimary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <ToggleRow
            label="Boost people you talk to"
            description="Prioritize posts from people you've commented with recently."
            enabled={boostPeople}
            onToggle={() => setBoostPeople((prev) => !prev)}
          />
          <ToggleRow
            label="Boost active conversations"
            description="Prioritize posts with fresh replies."
            enabled={boostActive}
            onToggle={() => setBoostActive((prev) => !prev)}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-textPrimary">Topics to show more</p>
          <div className="flex flex-wrap gap-2">
            {topicOptions.map((topic) => (
              <button
                key={topic}
                onClick={() => toggleTopic(topic, topics, setTopics)}
                className={`rounded-full border px-3 py-1 text-sm capitalize transition ${
                  topics.has(topic)
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-textMuted hover:text-textPrimary'
                }`}
              >
                #{topic}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-textPrimary">Muted topics</p>
          <div className="flex flex-wrap gap-2">
            {mutedOptions.map((topic) => (
              <button
                key={topic}
                onClick={() => toggleTopic(topic, muted, setMuted)}
                className={`rounded-full border px-3 py-1 text-sm capitalize transition ${
                  muted.has(topic)
                    ? 'border-border bg-border/20 text-textMuted'
                    : 'border-border text-textMuted hover:border-accent/40 hover:text-textPrimary'
                }`}
              >
                #{topic}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-textMuted">
          {summary}
        </div>
      </div>
    </section>
  );
};

const ToggleRow = ({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) => (
  <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 p-4">
    <div>
      <p className="text-sm font-semibold text-textPrimary">{label}</p>
      <p className="text-xs text-textMuted">{description}</p>
    </div>
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-6 w-12 rounded-full border transition ${
        enabled ? 'border-accent bg-accent/20' : 'border-border'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export default AlgoSection;
