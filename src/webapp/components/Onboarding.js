import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useTopicStore } from '../store/useTopicStore';
import { userService } from '../lib/firestore';
import { generateAndSaveProfileSummary } from '../lib/services/profileSummaryAgent';
import { extractInterestsFromStatement } from '../lib/services/profileInterestAgent';
const STEP_TITLES = {
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
    const [currentStep, setCurrentStep] = useState(1);
    const [profileForm, setProfileForm] = useState({
        displayName: currentUser?.name || '',
        userId: currentUser?.handle || '',
        bio: currentUser?.bio || '',
        url: currentUser?.url || '',
        location: currentUser?.location || '',
    });
    const [semanticInterests, setSemanticInterests] = useState(currentUser?.interests || []);
    const [unifiedInterestInput, setUnifiedInterestInput] = useState('');
    const [interestError, setInterestError] = useState('');
    const [interestLoading, setInterestLoading] = useState(false);
    const [stepError, setStepError] = useState('');
    const [generalError, setGeneralError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userIdStatus, setUserIdStatus] = useState('idle');
    const [userIdMessage, setUserIdMessage] = useState('');
    const [followSuggestions, setFollowSuggestions] = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const userIdTimerRef = useRef(null);
    useEffect(() => {
        if (!currentUser)
            return;
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
    const checkHandleAvailability = async (handle) => {
        if (!handle || handle.length < 3 || !currentUser)
            return false;
        try {
            const existing = await userService.getUserByHandle(handle);
            return !existing || existing.id === currentUser.id;
        }
        catch (error) {
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
    const looksLikeStatement = (text) => {
        const trimmed = text.trim();
        if (trimmed.length < 10)
            return false;
        const statementIndicators = [
            /\b(i|i'd|i'll|i've|i'm|i want|i like|i prefer|i need|i'm interested|show me|give me|more|less|fewer)\b/i,
            /[.!?]\s*$/,
            /\b(and|or|but|because|since|when|where|how|what|why)\b/i,
            /\b(should|would|could|might|may|can)\b/i,
        ];
        return statementIndicators.some((pattern) => pattern.test(trimmed));
    };
    const addInterest = async (value) => {
        const input = (value ?? unifiedInterestInput).trim();
        if (!input) {
            setInterestError('Add an interest or describe what you want to see.');
            return;
        }
        setInterestError('');
        setInterestLoading(true);
        try {
            if (looksLikeStatement(input)) {
                try {
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
                }
                catch (aiError) {
                    // If the AI proxy is unavailable (e.g., local dev without /api proxy), fall back to adding the raw text.
                    const fallback = input.toLowerCase();
                    setSemanticInterests((prev) => prev.includes(fallback) ? prev : [...prev, fallback]);
                    setUnifiedInterestInput('');
                    setInterestError('AI extractor unavailable; added your text directly.');
                    return;
                }
            }
            else {
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
        }
        catch (error) {
            console.error('[Onboarding] Error adding interest:', error);
            setInterestError('Could not add interest. Please try again.');
        }
        finally {
            setInterestLoading(false);
        }
    };
    const handleRemoveInterest = (interest) => {
        setSemanticInterests((prev) => prev.filter((item) => item !== interest));
    };
    const trendingTopicChips = useMemo(() => {
        if (!trendingTopics)
            return [];
        return trendingTopics.slice(0, 5);
    }, [trendingTopics]);
    useEffect(() => {
        if (!currentUser)
            return;
        let isActive = true;
        const loadSuggestions = async () => {
            setSuggestionsLoading(true);
            try {
                const results = await userService.getUsersWithSimilarInterests(semanticInterests, currentUser.id, 6);
                if (!isActive)
                    return;
                setFollowSuggestions(results);
            }
            catch (error) {
                console.error('[Onboarding] Error loading follow suggestions:', error);
                if (!isActive)
                    return;
                setFollowSuggestions([]);
            }
            finally {
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
    const followSuggestion = async (userId) => {
        try {
            await followUser(userId);
        }
        catch (error) {
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
            return Math.min(4, next);
        });
    };
    const handleBack = () => {
        setStepError('');
        setCurrentStep((prev) => {
            const prevStep = prev - 1;
            return Math.max(1, prevStep);
        });
    };
    const ensureMinimumFollows = async (userId, minCount = 3) => {
        const refreshed = await userService.getUser(userId);
        if (!refreshed)
            return null;
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
            const updateData = {
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
            navigate('/app');
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
        }
        catch (error) {
            // Only handle critical errors (profile save failure)
            console.error('[Onboarding] Error completing onboarding:', error);
            setGeneralError(error.message || 'Failed to complete onboarding.');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    if (!currentUser) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsx("div", { className: "text-textMuted", children: "Loading..." }) }));
    }
    const renderStepContent = () => {
        if (currentStep === 1) {
            return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsxs("label", { htmlFor: "displayName", className: "block text-xs font-medium text-textLabel mb-1.5", children: ["Display Name ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { id: "displayName", type: "text", value: profileForm.displayName, onChange: (e) => setProfileForm({ ...profileForm, displayName: e.target.value }), maxLength: 50, className: "w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "Your name" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("label", { htmlFor: "userId", className: "block text-xs font-medium text-textLabel mb-1.5", children: ["User ID ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-sm text-textMuted", children: "@" }), _jsx("input", { id: "userId", type: "text", value: profileForm.userId, onChange: (e) => setProfileForm({
                                                    ...profileForm,
                                                    userId: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                                                }), maxLength: 30, className: "flex-1 px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "username" })] }), _jsx("p", { className: "text-[10px] text-textMuted", children: userIdStatus === 'checking'
                                            ? 'Checking availability...'
                                            : userIdStatus === 'available'
                                                ? 'Handle available'
                                                : userIdStatus === 'taken'
                                                    ? 'Handle already taken'
                                                    : 'Letters, numbers, and underscores only' })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "bio", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Bio" }), _jsx("textarea", { id: "bio", value: profileForm.bio, onChange: (e) => setProfileForm({ ...profileForm, bio: e.target.value }), maxLength: 160, rows: 3, className: "w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none", placeholder: "Tell us about yourself..." }), _jsxs("p", { className: "text-xs text-textMuted", children: [profileForm.bio.length, "/160"] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "url", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Website" }), _jsx("input", { id: "url", type: "url", value: profileForm.url, onChange: (e) => setProfileForm({ ...profileForm, url: e.target.value }), className: "w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "https://..." })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "location", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Location" }), _jsx("input", { id: "location", type: "text", value: profileForm.location, onChange: (e) => setProfileForm({ ...profileForm, location: e.target.value }), maxLength: 50, className: "w-full px-3 py-2.5 text-sm bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "City, State" })] })] })] }));
        }
        if (currentStep === 2) {
            return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded-xl border border-border bg-background/60 px-4 py-3 text-xs leading-relaxed text-textMuted", children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary mb-1", children: "How this works" }), _jsxs("ul", { className: "space-y-1", children: [_jsx("li", { children: "\u2022 Add a keyword or phrase and hit Enter or Add." }), _jsx("li", { children: "\u2022 Write a full sentence and click Extract to auto-pull topics." }), _jsx("li", { children: "\u2022 Tap a chip to remove it, or pick from Trending below." })] })] }), _jsxs("label", { className: "block text-xs font-medium text-textLabel mb-2", children: ["Interests ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: unifiedInterestInput, onChange: (e) => {
                                            setUnifiedInterestInput(e.target.value);
                                            if (interestError)
                                                setInterestError('');
                                        }, onKeyDown: (e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                addInterest();
                                            }
                                        }, placeholder: looksLikeStatement(unifiedInterestInput)
                                            ? 'e.g. I want more AI research and less politics'
                                            : 'e.g. ai research, react development, or describe what you want', className: "flex-1 px-4 py-2.5 text-sm bg-white text-gray-900 dark:bg-slate-900 dark:text-white border border-border/80 dark:border-white/15 rounded-lg placeholder:text-textMuted/80 dark:placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent/60 dark:focus:border-accent/70 shadow-sm" }), _jsx("button", { type: "button", onClick: () => addInterest(), disabled: interestLoading || !unifiedInterestInput.trim(), className: "px-4 py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accentHover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm", children: interestLoading ? '...' : looksLikeStatement(unifiedInterestInput) ? 'Extract' : 'Add' })] }), interestError && (_jsx("p", { className: "text-xs text-red-500 dark:text-red-400 mt-1", children: interestError })), semanticInterests.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsxs("p", { className: "text-xs font-medium text-textLabel dark:text-white/60", children: ["Your interests (", semanticInterests.length, ")"] }), _jsx("div", { className: "flex flex-wrap gap-2", children: semanticInterests.map((interest) => (_jsxs("button", { type: "button", onClick: () => handleRemoveInterest(interest), className: "group px-3 py-1.5 bg-accent/10 dark:bg-accent/20 text-accent border border-accent/30 dark:border-accent/40 rounded-lg text-xs font-medium hover:bg-accent/20 dark:hover:bg-accent/30 hover:border-accent/50 dark:hover:border-accent/50 transition-all flex items-center gap-1.5", children: [_jsx("span", { children: interest }), _jsx("span", { className: "text-[10px] opacity-60 group-hover:opacity-100 transition-opacity", children: "\u00D7" })] }, interest))) })] })), semanticInterests.length === 0 && (_jsx("div", { className: "py-4 text-center", children: _jsx("p", { className: "text-xs text-textMuted dark:text-white/50 italic", children: "Add interests to personalize your feed" }) }))] }), _jsxs("div", { className: "space-y-3 pt-4 border-t border-border/50 dark:border-white/10", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-textMuted dark:text-white/60", children: "Trending topics" }), isLoadingTrending ? (_jsx("p", { className: "text-xs text-textMuted dark:text-white/50", children: "Loading trending topics..." })) : trendingTopicChips.length === 0 ? (_jsx("p", { className: "text-xs text-textMuted dark:text-white/50", children: "No trending topics yet" })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: trendingTopicChips.map((topic) => (_jsxs("button", { type: "button", onClick: () => addInterest(topic.name), className: "px-3 py-1.5 text-xs rounded-lg border border-border dark:border-white/10 bg-background/30 dark:bg-white/5 text-textPrimary dark:text-white hover:border-accent dark:hover:border-accent/60 hover:text-accent hover:bg-accent/5 dark:hover:bg-accent/10 transition-all", children: ["#", topic.name, " \u00B7 ", topic.postsLast1h, " kurals"] }, topic.name))) }))] })] }));
        }
        if (currentStep === 3) {
            return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-textMuted", children: "Follow people who share your interests to populate your feed immediately. You can skip this step and follow more people later." }), suggestionsLoading ? (_jsx("div", { className: "text-xs text-textMuted", children: "Loading suggestions..." })) : followSuggestions.length === 0 ? (_jsx("div", { className: "text-xs text-textMuted", children: "No suggestions yet. You can continue." })) : (_jsx("div", { className: "space-y-3", children: followSuggestions.map((person) => {
                            const following = isFollowing(person.id);
                            const similarityMeta = person._similarityMetadata;
                            const interestsMatched = similarityMeta?.matchingInterests || [];
                            return (_jsxs("div", { className: "rounded-xl px-3.5 py-3.5 transition-all duration-200 border border-border flex flex-col gap-2 bg-background/60", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary truncate", children: person.name }), _jsxs("p", { className: "text-xs text-textMuted truncate", children: ["@", person.handle] }), interestsMatched.length > 0 && (_jsxs("div", { className: "mt-1 flex flex-wrap gap-1", children: [interestsMatched.slice(0, 3).map((interest, index) => (_jsx("span", { className: "px-2 py-0.5 text-[10px] bg-accent/20 text-accent rounded-md", children: interest }, `${person.id}-${interest}-${index}`))), interestsMatched.length > 3 && (_jsxs("span", { className: "px-2 py-0.5 text-[10px] text-textMuted rounded-md", children: ["+", interestsMatched.length - 3, " more"] }))] }))] }), _jsx("button", { type: "button", onClick: () => followSuggestion(person.id), className: `ml-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${following
                                                    ? 'bg-backgroundHover text-textMuted border border-border'
                                                    : 'bg-gradient-to-r from-primary to-accent text-white hover:from-primaryHover hover:to-accentHover'}`, children: following ? 'Following' : 'Follow' })] }), person.bio && _jsx("p", { className: "text-[11px] text-textMuted", children: person.bio })] }, person.id));
                        }) }))] }));
        }
        return (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-textMuted", children: "The basics are set. Your interests and profile summary will power the tuned feed. Review what we collected and when you\u2019re ready, continue to the feed." }), _jsxs("ul", { className: "text-xs space-y-1 text-textPrimary", children: [_jsxs("li", { children: [_jsx("strong", { children: "Display Name:" }), " ", profileForm.displayName || 'N/A'] }), _jsxs("li", { children: [_jsx("strong", { children: "User ID:" }), " @", normalizedHandle || 'N/A'] }), _jsxs("li", { children: [_jsx("strong", { children: "Interests:" }), " ", semanticInterests.join(', ') || 'None yet'] })] })] }));
    };
    return (_jsx("div", { className: "min-h-screen bg-background px-4 py-8", children: _jsxs("div", { className: "mx-auto flex min-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-border bg-background/60 shadow-[0_30px_60px_rgba(15,12,41,0.18)] lg:flex-row", children: [_jsxs("aside", { className: "relative hidden w-full max-w-md flex-1 flex-col justify-between overflow-hidden rounded-[32px] bg-gradient-to-br from-primary/85 via-primary/60 to-accent/70 p-8 text-white lg:flex", children: [_jsxs("div", { className: "absolute inset-0", children: [_jsx("div", { className: "absolute -right-16 top-10 h-56 w-56 rounded-full bg-white/10 blur-[80px]" }), _jsx("div", { className: "absolute -left-10 bottom-8 h-64 w-64 rounded-full bg-white/20 blur-[70px]" })] }), _jsxs("div", { className: "relative z-10 space-y-6", children: [_jsxs("div", { className: "inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.4em] text-white/80", children: [_jsx("span", { children: "Kural" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kural logo", className: "h-4 w-auto" })] }), _jsx("p", { className: "text-lg font-semibold text-white", children: "Craft your experience with intention before you land in the app." }), _jsx("div", { className: "space-y-3", children: STEP_OVERVIEW.map((item) => (_jsxs("div", { className: `rounded-2xl border px-4 py-3 transition ${currentStep === item.step
                                            ? 'border-white/70 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
                                            : 'border-white/20 bg-white/5'}`, children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-white/60", children: [_jsxs("span", { children: ["Step ", item.step] }), currentStep === item.step && _jsx("span", { className: "text-[9px] text-white", children: "Current" })] }), _jsx("p", { className: "mt-2 text-sm font-semibold text-white", children: item.title }), _jsx("p", { className: "text-xs text-white/70", children: item.description })] }, item.step))) })] })] }), _jsxs("div", { className: "flex flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:px-10", children: [_jsx("div", { className: "mb-6 flex items-center justify-end gap-3", children: _jsx("button", { type: "button", onClick: () => navigate('/signup'), className: "text-sm font-semibold text-textMuted hover:text-textPrimary transition-colors", children: "\u2190 Back to signup" }) }), _jsxs("div", { className: "space-y-6 rounded-[32px] border border-border/70 bg-card/90 p-6 shadow-[0_10px_40px_rgba(15,12,41,0.15)] backdrop-blur-xl sm:p-8", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("p", { className: "text-xs uppercase tracking-[0.4em] text-textMuted", children: ["Step ", currentStep, " of 4"] }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h1", { className: "text-3xl font-bold text-textPrimary", children: STEP_TITLES[currentStep] }), _jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-textMuted", children: stepCaption })] }), _jsx("div", { className: "h-2 rounded-full bg-background/20", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300", style: { width: `${stepProgress}%` } }) })] }), _jsxs("div", { className: "space-y-5", children: [renderStepContent(), stepError && (_jsx("div", { className: "px-3 py-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg", children: stepError })), _jsxs("div", { className: "flex items-center justify-between border-t border-border pt-4", children: [currentStep > 1 ? (_jsx("button", { type: "button", onClick: handleBack, className: "text-sm text-textMuted hover:text-textPrimary transition-colors", children: "\u2190 Back" })) : (_jsx("div", {})), currentStep < 4 ? (_jsx("button", { type: "button", onClick: handleNext, className: "px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors", children: "Continue" })) : (_jsx("button", { type: "button", onClick: handleComplete, disabled: isSubmitting, className: "px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary to-accent text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: isSubmitting ? 'Saving...' : 'Complete setup' }))] }), generalError && (_jsx("div", { className: "px-3 py-2 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg", children: generalError }))] })] })] })] }) }));
};
export default Onboarding;
