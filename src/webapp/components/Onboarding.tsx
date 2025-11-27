import { useState, useEffect, FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { userService } from '../lib/firestore';
import { generateAndSaveProfileSummary } from '../lib/services/profileSummaryAgent';
import { extractInterestsFromStatement } from '../lib/services/profileInterestAgent';

const Onboarding = () => {
  const { currentUser, setCurrentUser } = useUserStore();
  const navigate = useNavigate();
  
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [userId, setUserId] = useState(currentUser?.handle || '');
  const [semanticInterests, setSemanticInterests] = useState<string[]>(currentUser?.interests || []);
  const [unifiedInterestInput, setUnifiedInterestInput] = useState('');
  const [interestError, setInterestError] = useState('');
  const [interestLoading, setInterestLoading] = useState(false);
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [url, setUrl] = useState(currentUser?.url || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUserId, setCheckingUserId] = useState(false);

  useEffect(() => {
    setSemanticInterests(currentUser?.interests || []);
  }, [currentUser?.interests]);

  // Detect if input looks like a statement (natural language) vs direct interest
  const looksLikeStatement = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 10) return false; // Too short to be a statement
    
    // Check for sentence indicators
    const statementIndicators = [
      /\b(i|i'd|i'll|i've|i'm|i want|i like|i prefer|i need|i'm interested|show me|give me|more|less|fewer)\b/i,
      /[.!?]\s*$/, // Ends with punctuation
      /\b(and|or|but|because|since|when|where|how|what|why)\b/i, // Conjunctions
      /\b(should|would|could|might|may|can)\b/i, // Modal verbs
    ];
    
    return statementIndicators.some(pattern => pattern.test(trimmed));
  };

  const handleUnifiedInterestSubmit = async () => {
    const input = unifiedInterestInput.trim();
    if (!input) {
      setInterestError('Enter an interest or describe what you want to see.');
      return;
    }

    setInterestError('');
    setInterestLoading(true);

    try {
      // Check if it looks like a statement - if so, extract interests
      if (looksLikeStatement(input)) {
        const extracted = await extractInterestsFromStatement(input);
        if (extracted.length === 0) {
          setInterestError('Could not extract interests. Try adding keywords directly or rephrase your statement.');
          return;
        }

        setSemanticInterests((prev) => {
          const combined = [...prev, ...extracted];
          const unique = Array.from(new Set(combined.map(i => i.toLowerCase())));
          return unique;
        });
        setUnifiedInterestInput('');
      } else {
        // Treat as direct interest
        const normalized = input.toLowerCase();
        if (semanticInterests.includes(normalized)) {
          setInterestError('Interest already added.');
          return;
        }
        if (normalized.length < 2) {
          setInterestError('Interest must be at least 2 characters.');
          return;
        }
        setSemanticInterests([...semanticInterests, normalized]);
        setUnifiedInterestInput('');
      }
    } catch (error: any) {
      console.error('[Onboarding] Error processing interest:', error);
      setInterestError('Failed to process. Try again or add keywords directly.');
    } finally {
      setInterestLoading(false);
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setSemanticInterests(semanticInterests.filter((i) => i !== interest));
  };

  const handleInterestKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUnifiedInterestSubmit();
    }
  };


  const checkUserIdAvailability = async (userIdToCheck: string): Promise<boolean> => {
    if (!userIdToCheck || userIdToCheck.length < 3) return false;
    
    try {
      setCheckingUserId(true);
      // Check if user with this handle exists
      const existingUser = await userService.getUserByHandle(userIdToCheck);
      // Available if no user exists, or if it's the current user's handle
      return !existingUser || (currentUser !== null && existingUser.id === currentUser.id);
    } catch (error) {
      console.error('Error checking user ID:', error);
      return true; // Assume available on error
    } finally {
      setCheckingUserId(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (!userId.trim()) {
      setError('User ID is required');
      return;
    }

    if (!userId.match(/^[a-zA-Z0-9_]+$/)) {
      setError('User ID can only contain letters, numbers, and underscores');
      return;
    }

    if (userId.length < 3) {
      setError('User ID must be at least 3 characters');
      return;
    }

    // Check if user ID is available
    const isAvailable = await checkUserIdAvailability(userId);
    if (!isAvailable) {
      setError('This user ID is already taken. Please choose another.');
      return;
    }

    if (semanticInterests.length === 0) {
      setError('Add at least one interest to personalize your feed');
      return;
    }

    setLoading(true);

    try {
      if (!currentUser) {
        setError('No user found. Please sign in again.');
        navigate('/login');
        return;
      }

      // Update user with onboarding data
      // Build update object, only including fields with values (Firestore doesn't accept undefined)
      const updateData: any = {
        displayName: displayName.trim(),
        userId: userId.trim().toLowerCase(),
        handle: userId.trim().toLowerCase(), // Also update handle
        name: displayName.trim(), // Also update name
        topics: [], // Keep empty array for backward compatibility (legacy field)
        onboardingCompleted: true,
        interests: semanticInterests, // Semantic interests are the primary system
      };

      // Only add optional fields if they have values
      const trimmedBio = bio.trim();
      if (trimmedBio) {
        updateData.bio = trimmedBio;
      }

      const trimmedUrl = url.trim();
      if (trimmedUrl) {
        updateData.url = trimmedUrl;
      }

      const trimmedLocation = location.trim();
      if (trimmedLocation) {
        updateData.location = trimmedLocation;
      }

      await userService.updateUser(currentUser.id, updateData);

      // Update current user in store
      const updatedUser = await userService.getUser(currentUser.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }

      // Generate profile summary asynchronously (don't block navigation)
      generateAndSaveProfileSummary(currentUser.id).catch((error) => {
        console.error('[Onboarding] Error generating profile summary:', error);
        // Non-critical, continue even if summary generation fails
      });

      // Navigate to app
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-4">
      <div className="w-full max-w-xl">
        <div className="bg-background/50 border border-border rounded-2xl p-5 shadow-lg">
          <h1 className="text-xl font-bold text-textPrimary mb-1">Complete Your Profile</h1>
          <p className="text-sm text-textMuted mb-4">Let's set up your profile to get started</p>

          {error && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name and User ID - Side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="displayName" className="block text-xs font-medium text-textLabel mb-1.5">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="userId" className="block text-xs font-medium text-textLabel mb-1.5">
                  User ID <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-textMuted">@</span>
                  <input
                    id="userId"
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    pattern="[a-zA-Z0-9_]+"
                    minLength={3}
                    maxLength={30}
                    className="flex-1 px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="username"
                  />
                  {checkingUserId && (
                    <span className="text-xs text-textMuted">Checking...</span>
                  )}
                </div>
              </div>
            </div>

          {/* Interests */}
          <div>
            <label className="block text-xs font-medium text-textLabel mb-1.5">
              Interests <span className="text-red-500">*</span>
            </label>
            <div className={`mb-2 p-2.5 bg-background/30 border border-border rounded-lg max-h-32 overflow-y-auto`}>
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
                onKeyDown={handleInterestKeyDown}
                placeholder={looksLikeStatement(unifiedInterestInput) 
                  ? "e.g. I want more AI research and less politics" 
                  : "e.g. ai research, react development, or describe what you want"}
                className="flex-1 px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
              />
              <button
                type="button"
                onClick={handleUnifiedInterestSubmit}
                disabled={loading || interestLoading || !unifiedInterestInput.trim()}
                className="px-3 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {interestLoading ? '...' : looksLikeStatement(unifiedInterestInput) ? 'Extract' : 'Add'}
              </button>
            </div>
            {interestError && (
              <p className="text-xs text-red-500 mt-1">{interestError}</p>
            )}
          </div>

            {/* Bio, URL, Location - Compact grid */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="bio" className="block text-xs font-medium text-textLabel mb-1.5">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                  placeholder="Tell us about yourself..."
                />
                <p className="mt-1 text-xs text-textMuted">{bio.length}/160</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="url" className="block text-xs font-medium text-textLabel mb-1.5">
                    Website
                  </label>
                  <input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label htmlFor="location" className="block text-xs font-medium text-textLabel mb-1.5">
                    Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={50}
                    className="w-full px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="City, State"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <button
                type="submit"
                disabled={loading || checkingUserId || semanticInterests.length === 0}
                className="w-full py-2 px-4 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

