import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useTopicStore } from '../store/useTopicStore';
import { userService } from '../lib/firestore';
import { generateAndSaveProfileSummary } from '../lib/services/profileSummaryAgent';
import { extractInterestsFromStatement } from '../lib/services/profileInterestAgent';
import type { User } from '../types';

type OnboardingStep = 1 | 2 | 3 | 4;

const STEP_TITLES: Record<OnboardingStep, string> = {
  1: 'Profile basics',
  2: 'Interests',
  3: 'People to follow',
  4: 'Ready to go',
};

const STEP_OVERVIEW = [
  { step: 1, title: 'Profile basics', description: 'Set a display name, handle, and bio that feel like you.' },
  { step: 2, title: 'Interests', description: 'Share what you want to see so your feed learns fast.' },
  { step: 3, title: 'People to follow', description: 'Pick a few creators to seed your conversation space.' },
  { step: 4, title: 'Ready to go', description: 'Review what we captured before diving into the feed.' },
];

const Onboarding = () => {
  const { currentUser, setCurrentUser, followUser, isFollowing } = useUserStore();
  const { trendingTopics, isLoadingTrending, loadTrendingTopics } = useTopicStore();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [profileForm, setProfileForm] = useState({
    displayName: currentUser?.name || '',
    userId: currentUser?.handle || '',
    bio: currentUser?.bio || '',
    url: currentUser?.url || '',
    location: currentUser?.location || '',
  });
  const [semanticInterests, setSemanticInterests] = useState<string[]>(currentUser?.interests || []);
  const [unifiedInterestInput, setUnifiedInterestInput] = useState('');
  const [interestError, setInterestError] = useState('');
  const [interestLoading, setInterestLoading] = useState(false);
  const [stepError, setStepError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userIdStatus, setUserIdStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [userIdMessage, setUserIdMessage] = useState('');
  const [followSuggestions, setFollowSuggestions] = useState<User[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const userIdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setSemanticInterests(currentUser.interests || []);
    setProfileForm((prev) => ({
      ...prev,
      displayName: currentUser.name || prev.displayName,
      userId: currentUser.handle || prev.userId,
      bio: currentUser.bio || '',
      url: currentUser.url || '',
      location: currentUser.location || '',
    }));
  }, [currentUser]);

  useEffect(() => {
    loadTrendingTopics(6);
  }, [loadTrendingTopics]);

  const normalizedHandle = useMemo(() => profileForm.userId.trim().toLowerCase(), [profileForm.userId]);

  const stepCaption = useMemo(() => {
    switch (currentStep) {
      case 1:
        return 'Profile basics';
      case 2:
        return 'Interest selection';
      case 3:
        return 'People to follow';
      default:
        return 'Ready to go';
    }
  }, [currentStep]);

  const stepProgress = useMemo(() => {
    const percent = ((currentStep - 1) / 3) * 100;
    return Math.min(100, Math.max(0, percent));
  }, [currentStep]);

  const checkHandleAvailability = async (handle: string) => {
    if (!handle || handle.length < 3 || !currentUser) return false;
    try {
      const existing = await userService.getUserByHandle(handle);
      return !existing || existing.id === currentUser.id;
    } catch (error) {
      console.error('[Onboarding] Error checking handle availability:', error);
      return true;
    }
  };

  useEffect(() => {
    if (!normalizedHandle) {
      setUserIdStatus('idle');
      setUserIdMessage('');
      return;
    }

    setUserIdStatus('checking');
    if (userIdTimerRef.current) {
      clearTimeout(userIdTimerRef.current);
    }

    userIdTimerRef.current = setTimeout(async () => {
      const available = await checkHandleAvailability(normalizedHandle);
      setUserIdStatus(available ? 'available' : 'taken');
      setUserIdMessage(available ? 'Handle available' : 'Handle already taken');
    }, 600);

    return () => {
      if (userIdTimerRef.current) {
        clearTimeout(userIdTimerRef.current);
      }
    };
  }, [normalizedHandle, currentUser?.id]);

  const looksLikeStatement = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 10) return false;
    const statementIndicators = [
      /\b(i|i'd|i'll|i've|i'm|i want|i like|i prefer|i need|i'm interested|show me|give me|more|less|fewer)\b/i,
      /[.!?]\s*$/,
      /\b(and|or|but|because|since|when|where|how|what|why)\b/i,
      /\b(should|would|could|might|may|can)\b/i,
    ];
    return statementIndicators.some((pattern) => pattern.test(trimmed));
  };

  const addInterest = async (value?: string) => {
    const input = (value ?? unifiedInterestInput).trim();
    if (!input) {
      setInterestError('Add an interest or describe what you want to see.');
      return;
    }

    setInterestError('');
    setInterestLoading(true);

    try {
      if (looksLikeStatement(input)) {
        const extracted = await extractInterestsFromStatement(input);
        if (extracted.length === 0) {
          setInterestError('Could not extract interests. Try using keywords.');
          return;
        }
        setSemanticInterests((prev) => {
          const combined = [...prev, ...extracted];
          const unique = Array.from(new Set(combined.map((interest) => interest.toLowerCase())));
          return unique;
        });
        setUnifiedInterestInput('');
      } else {
        const normalized = input.toLowerCase();
        if (semanticInterests.includes(normalized)) {
          setInterestError('Interest already added.');
          return;
        }
        if (normalized.length < 2) {
          setInterestError('Interest must be at least 2 characters.');
          return;
        }
        setSemanticInterests((prev) => [...prev, normalized]);
        if (!value) {
        setUnifiedInterestInput('');
      }
      }
    } catch (error) {
      console.error('[Onboarding] Error adding interest:', error);
      setInterestError('Could not add interest. Please try again.');
    } finally {
      setInterestLoading(false);
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setSemanticInterests((prev) => prev.filter((item) => item !== interest));
  };

  const trendingTopicChips = useMemo(() => {
    if (!trendingTopics) return [];
    return trendingTopics.slice(0, 5);
  }, [trendingTopics]);

  useEffect(() => {
    if (!currentUser) return;
    let isActive = true;
    const loadSuggestions = async () => {
      setSuggestionsLoading(true);
      try {
        const results = await userService.getUsersWithSimilarInterests(
          semanticInterests,
          currentUser.id,
          6
        );
        if (!isActive) return;
        setFollowSuggestions(results);
      } catch (error) {
        console.error('[Onboarding] Error loading follow suggestions:', error);
        if (!isActive) return;
        setFollowSuggestions([]);
      } finally {
        if (isActive) {
          setSuggestionsLoading(false);
        }
      }
    };

    loadSuggestions();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, semanticInterests]);

  const followSuggestion = async (userId: string) => {
    try {
      await followUser(userId);
    } catch (error) {
      console.error('[Onboarding] Failed to follow user:', error);
    }
  };

  const hasProfileStepError = () => {
    if (!profileForm.displayName.trim()) {
      setStepError('Display name is required.');
      return true;
    }
    if (!normalizedHandle) {
      setStepError('User ID is required.');
      return true;
    }
    if (!/^[a-z0-9_]+$/i.test(normalizedHandle)) {
      setStepError('Handle can only contain letters, numbers, and underscores.');
      return true;
    }
    if (normalizedHandle.length < 3) {
      setStepError('User ID must be at least 3 characters.');
      return true;
    }
    if (userIdStatus === 'taken') {
      setStepError('User ID is already taken.');
      return true;
    }
    if (userIdStatus === 'checking') {
      setStepError('Waiting for handle availability check...');
      return true;
    }
    return false;
  };

  const handleNext = () => {
    setStepError('');
    if (currentStep === 1 && hasProfileStepError()) {
      return;
    }
    if (currentStep === 2 && semanticInterests.length === 0) {
      setStepError('Add at least one interest to personalize your feed.');
      return;
    }
    setCurrentStep((prev) => {
      const next = prev + 1;
      return (Math.min(4, next) as OnboardingStep);
    });
  };

  const handleBack = () => {
    setStepError('');
    setCurrentStep((prev) => {
      const prevStep = prev - 1;
      return (Math.max(1, prevStep) as OnboardingStep);
    });
  };

  const ensureMinimumFollows = async (userId: string, minCount: number = 3) => {
    const refreshed = await userService.getUser(userId);
    if (!refreshed) return null;
    if ((refreshed.following?.length || 0) >= minCount) {
      return refreshed;
    }

    const popular = await userService.getPopularAccounts(8);
    const candidateIds = popular
      .map((user) => user.id)
      .filter((id) => id !== userId && !(refreshed.following || []).includes(id))
      .slice(0, minCount - (refreshed.following?.length || 0));

    if (candidateIds.length === 0) {
      return refreshed;
    }

    const updated = await userService.autoFollowAccounts(userId, candidateIds);
    return updated || refreshed;
  };

  const handleComplete = async () => {
    if (!currentUser) {
      setGeneralError('No user found. Please sign in again.');
      return;
    }

    setGeneralError('');
    setIsSubmitting(true);

    try {
      const updateData: any = {
        displayName: profileForm.displayName.trim(),
        userId: normalizedHandle,
        handle: normalizedHandle,
        name: profileForm.displayName.trim(),
        topics: [],
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        interests: semanticInterests,
        firstTimeUser: true,
      };

      // Only add optional fields if they have values (don't include undefined)
      const trimmedBio = profileForm.bio.trim();
      if (trimmedBio) {
        updateData.bio = trimmedBio;
      }

      const trimmedUrl = profileForm.url.trim();
      if (trimmedUrl) {
        updateData.url = trimmedUrl;
      }

      const trimmedLocation = profileForm.location.trim();
      if (trimmedLocation) {
        updateData.location = trimmedLocation;
      }

      // Save profile data (CRITICAL - must complete before navigation)
      await userService.updateUser(currentUser.id, updateData);

      const followUpdated = await ensureMinimumFollows(currentUser.id);
      if (followUpdated) {
        setCurrentUser(followUpdated);
      }

      // Navigate immediately - don't wait for AI operations
      navigate('/');

      // Generate profile summary in background (NON-CRITICAL)
      // This happens asynchronously and doesn't block the user
      generateAndSaveProfileSummary(currentUser.id)
        .then(async (summary) => {
          if (summary) {
            // Refresh user data when summary is ready
            const refreshed = await userService.getUser(currentUser.id);
            if (refreshed) {
              setCurrentUser(refreshed);
            }
          }
        })
        .catch((error) => {
          // Log but don't block user - summary generation is non-critical
          console.error('[Onboarding] Profile summary generation failed (non-critical):', error);
        });
    } catch (error: any) {
      // Only handle critical errors (profile save failure)
      console.error('[Onboarding] Error completing onboarding:', error);
      setGeneralError(error.message || 'Failed to complete onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) {
  return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-textMuted">Loading...</div>
            </div>
    );
  }

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="displayName" className="block text-xs font-medium text-textLabel mb-1.5">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                maxLength={50}
                className="w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="userId" className="block text-xs font-medium text-textLabel mb-1.5">
                User ID <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-textMuted">@</span>
                <input
                  id="userId"
                  type="text"
                  value={profileForm.userId}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      userId: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                    })
                  }
                  maxLength={30}
                  className="flex-1 px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="username"
                />
              </div>
              <p className="text-[10px] text-textMuted">
                {userIdStatus === 'checking'
                  ? 'Checking availability...'
                  : userIdStatus === 'available'
                  ? 'Handle available'
                  : userIdStatus === 'taken'
                  ? 'Handle already taken'
                  : 'Letters, numbers, and underscores only'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bio" className="block text-xs font-medium text-textLabel mb-1.5">
              Bio
            </label>
            <textarea
              id="bio"
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              maxLength={160}
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
              placeholder="Tell us about yourself..."
            />
            <p className="text-xs text-textMuted">{profileForm.bio.length}/160</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="url" className="block text-xs font-medium text-textLabel mb-1.5">
                Website
              </label>
              <input
                id="url"
                type="url"
                value={profileForm.url}
                onChange={(e) => setProfileForm({ ...profileForm, url: e.target.value })}
                className="w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="location" className="block text-xs font-medium text-textLabel mb-1.5">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={profileForm.location}
                onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                maxLength={50}
                className="w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="City, State"
              />
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-textLabel mb-1.5">
              Interests <span className="text-red-500">*</span>
            </label>
            <div className="mb-2 p-2.5 bg-background/30 border border-border rounded-lg max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {semanticInterests.length === 0 && (
                  <p className="text-xs text-textMuted italic">No interests yet</p>
                )}
                {semanticInterests.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => handleRemoveInterest(interest)}
                    className="px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full text-xs font-medium hover:bg-accent/25 transition-colors flex items-center gap-1"
                  >
                    {interest}
                    <span className="text-[10px]">×</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={unifiedInterestInput}
                onChange={(e) => {
                  setUnifiedInterestInput(e.target.value);
                  if (interestError) setInterestError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addInterest();
                  }
                }}
                placeholder={
                  looksLikeStatement(unifiedInterestInput)
                    ? 'e.g. I want more AI research and less politics'
                    : 'e.g. ai research, react development, or describe what you want'
                }
                className="flex-1 px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
              />
              <button
                type="button"
                onClick={() => addInterest()}
                disabled={interestLoading || !unifiedInterestInput.trim()}
                className="px-3 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {interestLoading ? '...' : looksLikeStatement(unifiedInterestInput) ? 'Extract' : 'Add'}
              </button>
            </div>
            {interestError && <p className="text-xs text-red-500 mt-1">{interestError}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Trending topics</p>
            {isLoadingTrending ? (
              <p className="text-xs text-textMuted">Loading trending topics...</p>
            ) : trendingTopicChips.length === 0 ? (
              <p className="text-xs text-textMuted">No trending topics yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trendingTopicChips.map((topic) => (
                  <button
                    key={topic.name}
                    type="button"
                    onClick={() => addInterest(topic.name)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
                  >
                    #{topic.name} · {topic.postsLast1h} chirps
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-textMuted">
            Follow people who share your interests to populate your feed immediately.
            You can skip this step and follow more people later.
          </p>
          {suggestionsLoading ? (
            <div className="text-xs text-textMuted">Loading suggestions...</div>
          ) : followSuggestions.length === 0 ? (
            <div className="text-xs text-textMuted">No suggestions yet. You can continue.</div>
          ) : (
            <div className="space-y-3">
              {followSuggestions.map((person) => {
                const following = isFollowing(person.id);
                const similarityMeta = (person as any)._similarityMetadata;
                const interestsMatched = similarityMeta?.matchingInterests || [];
                return (
                  <div
                    key={person.id}
                    className="rounded-xl px-3.5 py-3.5 transition-all duration-200 border border-border flex flex-col gap-2 bg-background/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-textPrimary truncate">{person.name}</p>
                        <p className="text-xs text-textMuted truncate">@{person.handle}</p>
                        {interestsMatched.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {interestsMatched.slice(0, 3).map((interest: string, index: number) => (
                              <span
                                key={`${person.id}-${interest}-${index}`}
                                className="px-2 py-0.5 text-[10px] bg-accent/20 text-accent rounded-md"
                              >
                                {interest}
                              </span>
                            ))}
                            {interestsMatched.length > 3 && (
                              <span className="px-2 py-0.5 text-[10px] text-textMuted rounded-md">
                                +{interestsMatched.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => followSuggestion(person.id)}
                        className={`ml-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                          following
                            ? 'bg-backgroundHover text-textMuted border border-border'
                            : 'bg-gradient-to-r from-primary to-accent text-white hover:from-primaryHover hover:to-accentHover'
                        }`}
                      >
                        {following ? 'Following' : 'Follow'}
                      </button>
                    </div>
                    {person.bio && <p className="text-[11px] text-textMuted">{person.bio}</p>}
                  </div>
                );
              })}
            </div>
          )}
              </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-textMuted">
          The basics are set. Your interests and profile summary will power the tuned feed.
          Review what we collected and when you’re ready, continue to the feed.
        </p>
        <ul className="text-xs space-y-1 text-textPrimary">
          <li>
            <strong>Display Name:</strong> {profileForm.displayName || 'N/A'}
          </li>
          <li>
            <strong>User ID:</strong> @{normalizedHandle || 'N/A'}
          </li>
          <li>
            <strong>Interests:</strong> {semanticInterests.join(', ') || 'None yet'}
          </li>
        </ul>
                </div>
    );
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex min-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-border bg-background/60 shadow-[0_30px_60px_rgba(15,12,41,0.18)] lg:flex-row">
        <aside className="relative hidden w-full max-w-md flex-1 flex-col justify-between overflow-hidden rounded-[32px] bg-gradient-to-br from-primary/85 via-primary/60 to-accent/70 p-8 text-white lg:flex">
          <div className="absolute inset-0">
            <div className="absolute -right-16 top-10 h-56 w-56 rounded-full bg-white/10 blur-[80px]" />
            <div className="absolute -left-10 bottom-8 h-64 w-64 rounded-full bg-white/20 blur-[70px]" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.4em] text-white/80">
              <span>Kural</span>
              <img src="/quotation-marks.png" alt="Kural logo" className="h-4 w-auto" />
            </div>
            <p className="text-lg font-semibold text-white">Craft your feed with intention before you land in the app.</p>
            <div className="space-y-3">
              {STEP_OVERVIEW.map((item) => (
                <div
                  key={item.step}
                  className={`rounded-2xl border px-4 py-3 transition ${
                    currentStep === item.step
                      ? 'border-white/70 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
                      : 'border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-white/60">
                    <span>Step {item.step}</span>
                    {currentStep === item.step && <span className="text-[9px] text-white">Current</span>}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-white/70">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-textMuted">
              <span className="text-base font-bold text-textPrimary">Kural</span>
              <img src="/quotation-marks.png" alt="Kural logo" className="h-5 w-auto" />
            </div>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="text-sm font-semibold text-textMuted hover:text-textPrimary transition-colors"
            >
              ← Back to signup
            </button>
          </div>

          <div className="space-y-6 rounded-[32px] border border-border/70 bg-card/90 p-6 shadow-[0_10px_40px_rgba(15,12,41,0.15)] backdrop-blur-xl sm:p-8">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.4em] text-textMuted">Step {currentStep} of 4</p>
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-bold text-textPrimary">{STEP_TITLES[currentStep]}</h1>
                <span className="text-xs font-semibold uppercase tracking-wide text-textMuted">{stepCaption}</span>
              </div>
              <div className="h-2 rounded-full bg-background/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
            </div>

            <div className="space-y-5">
              {renderStepContent()}
              {stepError && (
                <div className="px-3 py-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                  {stepError}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-4">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-sm text-textMuted hover:text-textPrimary transition-colors"
                  >
                    ← Back
                  </button>
                ) : (
                  <div />
                )}
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary to-accent text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Saving...' : 'Complete setup'}
                  </button>
                )}
              </div>
              {generalError && (
                <div className="px-3 py-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                  {generalError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

