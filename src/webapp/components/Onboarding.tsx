import { useState, useEffect, FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { userService } from '../lib/firestore';

const Onboarding = () => {
  const { currentUser, setCurrentUser } = useUserStore();
  const navigate = useNavigate();
  
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [userId, setUserId] = useState(currentUser?.handle || '');
  const [semanticInterests, setSemanticInterests] = useState<string[]>(currentUser?.interests || []);
  const [interestInput, setInterestInput] = useState('');
  const [interestError, setInterestError] = useState('');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [url, setUrl] = useState(currentUser?.url || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUserId, setCheckingUserId] = useState(false);

  useEffect(() => {
    setSemanticInterests(currentUser?.interests || []);
  }, [currentUser?.interests]);

  const handleAddInterest = () => {
    const normalized = interestInput.trim().toLowerCase();
    if (!normalized) {
      setInterestError('Enter an interest first.');
      return;
    }
    if (semanticInterests.includes(normalized)) {
      setInterestError('Interest already added.');
      return;
    }
    if (normalized.length < 2) {
      setInterestError('Interest must be at least 2 characters.');
      return;
    }
    setSemanticInterests([...semanticInterests, normalized]);
    setInterestInput('');
    setInterestError('');
  };

  const handleRemoveInterest = (interest: string) => {
    setSemanticInterests(semanticInterests.filter((i) => i !== interest));
  };

  const handleInterestKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddInterest();
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

      // Navigate to app
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-background/50 border border-border rounded-3xl p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-textPrimary mb-2">Complete Your Profile</h1>
          <p className="text-textMuted mb-6">Let's set up your profile to get started</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-textLabel mb-2">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={50}
                className="w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="Your display name"
              />
            </div>

            {/* User ID */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-textLabel mb-2">
                User ID <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-textMuted">@</span>
                <input
                  id="userId"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                  pattern="[a-zA-Z0-9_]+"
                  minLength={3}
                  maxLength={30}
                  className="flex-1 px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="username"
                />
                {checkingUserId && (
                  <span className="text-xs text-textMuted">Checking...</span>
                )}
              </div>
              <p className="mt-1 text-xs text-textMuted">3-30 characters, letters, numbers, and underscores only</p>
            </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-medium text-textLabel mb-2">
              Interests <span className="text-red-500">*</span>
              <span className="text-xs text-textMuted ml-2">(Natural language topics you care about)</span>
            </label>
            <div className="mb-3 p-4 bg-background/30 border border-border rounded-lg max-h-48 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {semanticInterests.length === 0 && (
                  <p className="text-sm text-textMuted italic">No interests yet. Add the topics you want to see in your feed.</p>
                )}
                {semanticInterests.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => handleRemoveInterest(interest)}
                    className="px-3 py-1 bg-accent/15 text-accent border border-accent/30 rounded-full text-sm font-medium hover:bg-accent/25 transition-colors flex items-center gap-1"
                  >
                    {interest}
                    <span className="text-xs">×</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={interestInput}
                onChange={(e) => {
                  setInterestInput(e.target.value);
                  if (interestError) setInterestError('');
                }}
                onKeyDown={handleInterestKeyDown}
                placeholder="e.g. react development, ai research, design leadership"
                className="flex-1 px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
              />
              <button
                type="button"
                onClick={handleAddInterest}
                disabled={loading}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {interestError && (
              <p className="text-xs text-red-500 mb-2">{interestError}</p>
            )}
            <p className="text-xs text-textMuted">
              These interests personalize your feed, news, and help you discover like-minded people. Add natural language topics such as "react", "startup funding", or "ai ethics".
            </p>
          </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-textLabel mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                placeholder="Tell us about yourself..."
              />
              <p className="mt-1 text-xs text-textMuted">{bio.length}/160 characters</p>
            </div>

            {/* URL */}
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-textLabel mb-2">
                Website URL
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="https://yourwebsite.com"
              />
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-textLabel mb-2">
                Location (City)
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={50}
                className="w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="New York, NY"
              />
            </div>

            <button
              type="submit"
              disabled={loading || checkingUserId || semanticInterests.length === 0}
              className="w-full py-3 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

