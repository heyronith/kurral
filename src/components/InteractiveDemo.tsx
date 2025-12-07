import { useMemo, useState } from 'react';
import { Chirp, chirpDataset } from '../data/chirps';

type DemoTab = 'latest' | 'forYou';
type Mix = 'following' | 'balanced' | 'everyone';

const topicOptions = ['dev', 'startups', 'music', 'sports'];
const mutedOptions = ['politics', 'crypto'];

const InteractiveDemo = () => {
  const [activeTab, setActiveTab] = useState<DemoTab>('latest');
  const [mix, setMix] = useState<Mix>('balanced');
  const [boostPeople, setBoostPeople] = useState(true);
  const [boostActive, setBoostActive] = useState(true);
  const [topicPrefs, setTopicPrefs] = useState<string[]>(['dev', 'startups']);
  const [mutedTopics, setMutedTopics] = useState<string[]>(['politics']);

  const latestFeed = useMemo(
    () => [...chirpDataset].sort((a, b) => a.minutesAgo - b.minutesAgo),
    []
  );

  const forYouFeed = useMemo(
    () =>
      computeForYouFeed(chirpDataset, {
        mix,
        boostPeople,
        boostActive,
        topicPrefs,
        mutedTopics,
      }),
    [boostActive, boostPeople, mix, mutedTopics, topicPrefs]
  );

  const feed = activeTab === 'latest' ? latestFeed : forYouFeed;
  const controlsDisabled = activeTab === 'latest';

  const reasonFor = (chirp: Chirp) =>
    activeTab === 'latest'
      ? 'Because: Latest - pure chronological'
      : buildForYouReason(chirp, { mix, boostPeople, boostActive, topicPrefs });

  const toggleTopic = (topic: string, list: string[], setter: (val: string[]) => void) => {
    if (list.includes(topic)) {
      setter(list.filter((item) => item !== topic));
    } else {
      setter([...list, topic]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-textLabel">Interactive demo</p>
        <h2 className="text-3xl font-semibold text-textPrimary">Tune For You without leaving Kural</h2>
        <p className="text-textMuted">
          Flip between Latest and For You, adjust the controls, and watch the feed update live.
        </p>
      </div>

      <div className="card-surface overflow-hidden rounded-[32px] border border-border/80 bg-[#050911] shadow-card">
        <div className="flex items-center gap-2 border-b border-border/70 px-6 py-4 text-sm text-textLabel">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
          <div className="mx-auto text-textMuted">kural.app/demo</div>
        </div>
        <div className="grid gap-8 px-6 py-10 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex rounded-full border border-border p-1 text-sm">
                {(['latest', 'forYou'] as DemoTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 rounded-full px-4 py-2 font-semibold capitalize transition ${
                      activeTab === tab ? 'bg-textPrimary text-background' : 'text-textMuted'
                    }`}
                  >
                    {tab === 'latest' ? 'Latest' : 'For You'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-textLabel">
                {activeTab === 'latest'
                  ? 'Latest is pure chronological. No ranking applied.'
                  : 'For You reflects your controls. Every change updates the feed.'}
              </p>
            </div>

            <div className="space-y-4">
              {feed.map((chirp) => (
                <ChirpCard key={chirp.id} chirp={chirp} reason={reasonFor(chirp)} />
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className={`card-surface space-y-5 p-5 transition ${
                controlsDisabled ? 'pointer-events-none opacity-40' : 'opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-textPrimary">For You controls</p>
                <span className="text-xs text-textLabel">live</span>
              </div>

              <div className="space-y-2 text-xs text-textLabel">
                <p>Following vs Everyone</p>
                <div className="flex gap-2">
                  {(
                    [
                      { id: 'following', label: 'Mostly Following' },
                      { id: 'balanced', label: 'Mixed' },
                      { id: 'everyone', label: 'Mostly Everyone' },
                    ] as { id: Mix; label: string }[]
                  ).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setMix(option.id)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        mix === option.id
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-textMuted hover:text-textPrimary'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleControl
                label="Boost people you talk to"
                description="Prioritize posts from recent conversations."
                enabled={boostPeople}
                onToggle={() => setBoostPeople((prev) => !prev)}
              />
              <ToggleControl
                label="Boost active conversations"
                description="Lift posts with fresh replies."
                enabled={boostActive}
                onToggle={() => setBoostActive((prev) => !prev)}
              />

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-textLabel">Topics to prioritize</p>
                <div className="flex flex-wrap gap-2">
                  {topicOptions.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic, topicPrefs, setTopicPrefs)}
                      className={`rounded-full border px-3 py-1 text-sm capitalize transition ${
                        topicPrefs.includes(topic)
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
                <p className="text-xs uppercase tracking-[0.2em] text-textLabel">Muted topics</p>
                <div className="flex flex-wrap gap-2">
                  {mutedOptions.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic, mutedTopics, setMutedTopics)}
                      className={`rounded-full border px-3 py-1 text-sm capitalize transition ${
                        mutedTopics.includes(topic)
                          ? 'border-border bg-border/30 text-textMuted'
                          : 'border-border text-textMuted hover:border-accent/40 hover:text-textPrimary'
                      }`}
                    >
                      #{topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {controlsDisabled && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-textLabel">
                For You controls are only applied when you're in the For You feed.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ToggleControl = ({
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
  <div className="rounded-2xl border border-border/70 p-4 text-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold text-textPrimary">{label}</p>
        <p className="text-xs text-textMuted">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full border transition ${
          enabled ? 'border-accent bg-accent/20' : 'border-border'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            enabled ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  </div>
);

const computeForYouFeed = (
  dataset: Chirp[],
  {
    mix,
    boostPeople,
    boostActive,
    topicPrefs,
    mutedTopics,
  }: {
    mix: Mix;
    boostPeople: boolean;
    boostActive: boolean;
    topicPrefs: string[];
    mutedTopics: string[];
  }
) => {
  return dataset
    .map((chirp) => {
      const muted = mutedTopics.includes(chirp.topic);
      let score = 100 - chirp.minutesAgo;

      if (mix === 'following') {
        score += chirp.authorFollowed ? 40 : -5;
      } else if (mix === 'balanced') {
        score += chirp.authorFollowed ? 25 : 10;
      } else {
        score += chirp.authorFollowed ? 10 : 35;
      }

      if (boostPeople && chirp.recentInteraction) score += 30;
      if (boostActive && chirp.activeComments) score += 25;
      if (topicPrefs.includes(chirp.topic)) score += 35;
      score += chirp.commentCount;

      if (muted) score -= 120;

      return { chirp, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ chirp }) => chirp);
};

const buildForYouReason = (
  chirp: Chirp,
  {
    mix,
    boostPeople,
    boostActive,
    topicPrefs,
  }: {
    mix: Mix;
    boostPeople: boolean;
    boostActive: boolean;
    topicPrefs: string[];
  }
) => {
  const reasons: string[] = [];
  if (topicPrefs.includes(chirp.topic)) reasons.push(`topic #${chirp.topic}`);
  if (boostPeople && chirp.recentInteraction) reasons.push(`you replied to ${chirp.handle}`);
  if (boostActive && chirp.activeComments) reasons.push('active conversation');
  if (chirp.authorFollowed && mix !== 'everyone') reasons.push(`following ${chirp.handle}`);
  if (!chirp.authorFollowed && mix === 'everyone') reasons.push('from everyone');
  if (!reasons.length) reasons.push('recency');
  return `Because: ${reasons.slice(0, 2).join(' + ')}`;
};

const ChirpCard = ({ chirp, reason }: { chirp: Chirp; reason: string }) => {
  return (
    <article className="rounded-2xl border border-border/70 bg-background/50 p-4 shadow-inner">
      <div className="flex items-start justify-between text-sm text-textMuted">
        <div>
          <p className="font-semibold text-textPrimary">{chirp.name}</p>
          <p>{chirp.handle}</p>
        </div>
        <span className="text-xs text-textLabel">{chirp.timestamp}</span>
      </div>
      <p className="mt-3 text-sm text-textPrimary">{chirp.text}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-textLabel">
        <span>
          {chirp.activeComments
            ? `Active now - ${chirp.commentCount} people discussing`
            : `${chirp.commentCount} replies - calm`}
        </span>
        <span className="rounded-full border border-border px-3 py-1 text-[11px] text-textMuted">{reason}</span>
      </div>
      <div className="mt-3 text-xs text-textLabel">#{chirp.topic}</div>
    </article>
  );
};

export default InteractiveDemo;
