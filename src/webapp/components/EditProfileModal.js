import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../lib/firestore';
import { deleteField } from 'firebase/firestore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { authService } from '../lib/auth';
import { generateAndSaveProfileSummary } from '../lib/services/profileSummaryAgent';
import { extractInterestsFromStatement } from '../lib/services/profileInterestAgent';
const EditProfileModal = ({ open, onClose, user, onUpdate }) => {
    const { updateInterests, setCurrentUser } = useUserStore();
    const { theme } = useThemeStore();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState(user.displayName || user.name || '');
    const [userId, setUserId] = useState(user.userId || user.handle || '');
    const [semanticInterests, setSemanticInterests] = useState(user.interests || []);
    const [unifiedInterestInput, setUnifiedInterestInput] = useState('');
    const [interestError, setInterestError] = useState('');
    const [interestLoading, setInterestLoading] = useState(false);
    const [bio, setBio] = useState(user.bio || '');
    const [url, setUrl] = useState(user.url || '');
    const [location, setLocation] = useState(user.location || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingUserId, setCheckingUserId] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    // Reset form when user changes or modal opens
    useEffect(() => {
        if (open && user) {
            setDisplayName(user.displayName || user.name || '');
            setUserId(user.userId || user.handle || '');
            setSemanticInterests(user.interests || []);
            setBio(user.bio || '');
            setUrl(user.url || '');
            setLocation(user.location || '');
            setUnifiedInterestInput('');
            setInterestError('');
            setError('');
        }
    }, [open, user]);
    // Detect if input looks like a statement (natural language) vs direct interest
    const looksLikeStatement = (text) => {
        const trimmed = text.trim();
        if (trimmed.length < 10)
            return false; // Too short to be a statement
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
            }
            else {
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
        }
        catch (error) {
            console.error('[EditProfileModal] Error processing interest:', error);
            setInterestError('Failed to process. Try again or add keywords directly.');
        }
        finally {
            setInterestLoading(false);
        }
    };
    const handleRemoveInterest = (interest) => {
        setSemanticInterests(semanticInterests.filter(i => i !== interest));
    };
    const handleInterestKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUnifiedInterestSubmit();
        }
    };
    const checkUserIdAvailability = async (userIdToCheck) => {
        if (!userIdToCheck || userIdToCheck.length < 3)
            return false;
        try {
            setCheckingUserId(true);
            // Check if user with this handle exists
            const existingUser = await userService.getUserByHandle(userIdToCheck);
            // Available if no user exists, or if it's the current user's handle
            return !existingUser || (user !== null && existingUser.id === user.id);
        }
        catch (error) {
            console.error('Error checking user ID:', error);
            return true; // Assume available on error
        }
        finally {
            setCheckingUserId(false);
        }
    };
    const handleSubmit = async (e) => {
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
        // Check if user ID is available (only if changed)
        if (userId.toLowerCase() !== (user.userId || user.handle).toLowerCase()) {
            const isAvailable = await checkUserIdAvailability(userId);
            if (!isAvailable) {
                setError('This user ID is already taken. Please choose another.');
                return;
            }
        }
        // Validate interests (recommended, not required)
        if (semanticInterests.length === 0) {
            setError('Please add at least one interest to help personalize your feed');
            return;
        }
        setLoading(true);
        try {
            // Build update object, only including fields with values (Firestore doesn't accept undefined)
            const updateData = {
                displayName: displayName.trim(),
                userId: userId.trim().toLowerCase(),
                handle: userId.trim().toLowerCase(), // Also update handle
                name: displayName.trim(), // Also update name
                interests: semanticInterests, // Update semantic interests
                // Keep legacy topics field in database for backward compatibility
                // If user has old topics, we preserve them (no longer editable in UI)
                topics: user.topics || [], // Preserve existing topics, don't update from UI
            };
            // Handle optional fields - remove if empty, add if has value
            const trimmedBio = bio.trim();
            if (trimmedBio) {
                updateData.bio = trimmedBio;
            }
            else if (user.bio) {
                // Remove bio if it was previously set but now empty
                updateData.bio = deleteField();
            }
            const trimmedUrl = url.trim();
            if (trimmedUrl) {
                updateData.url = trimmedUrl;
            }
            else if (user.url) {
                // Remove url if it was previously set but now empty
                updateData.url = deleteField();
            }
            const trimmedLocation = location.trim();
            if (trimmedLocation) {
                updateData.location = trimmedLocation;
            }
            else if (user.location) {
                // Remove location if it was previously set but now empty
                updateData.location = deleteField();
            }
            await userService.updateUser(user.id, updateData);
            // Also update interests via store to keep state in sync
            if (semanticInterests.length > 0 || user.interests?.length) {
                try {
                    await updateInterests(semanticInterests);
                }
                catch (interestError) {
                    console.warn('Failed to update interests via store (non-critical):', interestError);
                    // Continue even if store update fails
                }
            }
            // Reload updated user
            const updatedUser = await userService.getUser(user.id);
            if (updatedUser) {
                onUpdate(updatedUser);
                // Generate profile summary asynchronously after profile update
                generateAndSaveProfileSummary(user.id).catch((error) => {
                    console.error('[EditProfileModal] Error generating profile summary:', error);
                    // Non-critical, continue even if summary generation fails
                });
            }
            onClose();
        }
        catch (err) {
            setError(err.message || 'Failed to update profile');
        }
        finally {
            setLoading(false);
        }
    };
    const handleDeleteAccount = async () => {
        if (!user?.id)
            return;
        setIsDeleting(true);
        setDeleteError('');
        try {
            // Delete all user data
            const result = await userService.deleteAccount(user.id);
            console.log('Account deletion result:', result);
            // Sign out the user
            await authService.signOut();
            setCurrentUser(null);
            // Redirect to landing page
            navigate('/');
            onClose();
        }
        catch (err) {
            console.error('Error deleting account:', err);
            setDeleteError(err.message || 'Failed to delete account. Please try again or contact support.');
            setIsDeleting(false);
        }
    };
    if (!open)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-4", children: [_jsxs("div", { className: `relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border p-5 shadow-2xl ${theme === 'dark' ? 'border-white/20 bg-black' : 'border-border bg-background/95'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("div", { children: _jsx("h1", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Edit Profile" }) }), _jsx("button", { "aria-label": "Close edit profile", onClick: onClose, className: `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${theme === 'dark' ? 'border-white/20 bg-white/10 text-white/70 hover:border-accent hover:text-accent hover:bg-white/20' : 'border-border/70 bg-background/80 text-textMuted hover:border-accent hover:text-accent'}`, children: "Close" })] }), error && (_jsx("div", { className: "mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsxs("label", { htmlFor: "edit-displayName", className: `block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'}`, children: ["Display Name ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { id: "edit-displayName", type: "text", value: displayName, onChange: (e) => setDisplayName(e.target.value), required: true, maxLength: 50, className: `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-accent/50' : 'bg-background/50 border-border text-textPrimary placeholder:text-textMuted'}`, placeholder: "Your name" })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "edit-userId", className: `block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'}`, children: ["User ID ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "@" }), _jsx("input", { id: "edit-userId", type: "text", value: userId, onChange: (e) => setUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')), required: true, pattern: "[a-zA-Z0-9_]+", minLength: 3, maxLength: 30, className: `flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-accent/50' : 'bg-background/50 border-border text-textPrimary placeholder:text-textMuted'}`, placeholder: "username" }), checkingUserId && (_jsx("span", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "Checking..." }))] })] })] }), _jsxs("div", { children: [_jsxs("label", { className: `block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'}`, children: ["Interests ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("div", { className: `mb-2 p-2.5 border rounded-lg max-h-32 overflow-y-auto ${theme === 'dark' ? 'bg-white/5 border-white/20' : 'bg-background/30 border-border'}`, children: _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [semanticInterests.length === 0 && (_jsx("p", { className: `text-xs italic ${theme === 'dark' ? 'text-white/50' : 'text-textMuted'}`, children: "No interests yet" })), semanticInterests.map((interest) => (_jsxs("button", { type: "button", onClick: () => handleRemoveInterest(interest), className: "px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full text-xs font-medium hover:bg-accent/25 transition-colors flex items-center gap-1", children: [interest, _jsx("span", { className: "text-[10px]", children: "\u00D7" })] }, interest)))] }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: unifiedInterestInput, onChange: (e) => {
                                                    setUnifiedInterestInput(e.target.value);
                                                    if (interestError)
                                                        setInterestError('');
                                                }, onKeyDown: handleInterestKeyDown, placeholder: looksLikeStatement(unifiedInterestInput)
                                                    ? "e.g. I want more AI research and less politics"
                                                    : "e.g. ai research, react development, or describe what you want", className: `flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-background/50 border-border text-textPrimary placeholder:text-textMuted'}` }), _jsx("button", { type: "button", onClick: handleUnifiedInterestSubmit, disabled: loading || interestLoading || !unifiedInterestInput.trim(), className: "px-3 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap", children: interestLoading ? '...' : looksLikeStatement(unifiedInterestInput) ? 'Extract' : 'Add' })] }), interestError && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: interestError }))] }), _jsxs("div", { className: "grid grid-cols-1 gap-3", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "edit-bio", className: `block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'}`, children: "Bio" }), _jsx("textarea", { id: "edit-bio", value: bio, onChange: (e) => setBio(e.target.value), maxLength: 160, rows: 2, className: `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-accent/50' : 'bg-background/50 border-border text-textPrimary placeholder:text-textMuted'}`, placeholder: "Tell us about yourself..." }), _jsxs("p", { className: `mt-1 text-xs ${theme === 'dark' ? 'text-white/50' : 'text-textMuted'}`, children: [bio.length, "/160"] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "edit-url", className: `block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'}`, children: "Website" }), _jsx("input", { id: "edit-url", type: "url", value: url, onChange: (e) => setUrl(e.target.value), className: `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-accent/50' : 'bg-background/50 border-border text-textPrimary placeholder:text-textMuted'}`, placeholder: "https://..." })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "edit-location", className: `block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'}`, children: "Location" }), _jsx("input", { id: "edit-location", type: "text", value: location, onChange: (e) => setLocation(e.target.value), maxLength: 50, className: `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-accent/50' : 'bg-background/50 border-border text-textPrimary placeholder:text-textMuted'}`, placeholder: "City, State" })] })] })] }), _jsxs("div", { className: "space-y-4 pt-4 border-t border-border/50", children: [_jsx("h3", { className: `text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Account Settings" }), _jsxs("div", { className: `p-6 rounded-lg border-2 ${theme === 'dark' ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50'}`, children: [_jsx("h4", { className: `text-base font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-red-900'}`, children: "Delete Account" }), _jsx("p", { className: `text-sm mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-red-800'}`, children: "Permanently delete your account and all associated data. This action cannot be undone." }), _jsx("p", { className: `text-xs mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-red-700'}`, children: "This will delete all your posts, comments, bookmarks, and profile data immediately. Your Firebase Auth account will be scheduled for deletion separately (this may take up to 24 hours to process via our backend systems)." }), deleteError && (_jsx("div", { className: `mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-red-500/20 border border-red-500/50 text-red-300' : 'bg-red-100 border border-red-300 text-red-700'} text-sm`, children: deleteError })), _jsx("button", { type: "button", onClick: () => setShowDeleteConfirm(true), disabled: isDeleting, className: `px-4 py-2 rounded-lg font-medium transition-all ${theme === 'dark'
                                                    ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                                                    : 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'}`, children: isDeleting ? 'Deleting Account...' : 'Delete My Account' })] })] }), _jsxs("div", { className: "flex gap-2 pt-2 border-t border-border/50", children: [_jsx("button", { type: "button", onClick: onClose, className: `flex-1 py-2 px-4 text-sm border rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-background/50 border-border text-textPrimary hover:bg-background/70'}`, children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading || checkingUserId || semanticInterests.length === 0, className: "flex-1 py-2 px-4 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Saving...' : 'Save Changes' })] })] })] }), showDeleteConfirm && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm", children: _jsxs("div", { className: `max-w-md w-full mx-4 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'} shadow-xl`, children: [_jsx("h3", { className: `text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`, children: "Delete Account" }), _jsx("p", { className: `mb-6 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`, children: "Are you sure you want to delete your account? This will permanently delete:" }), _jsxs("ul", { className: `list-disc list-inside mb-6 space-y-1 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'} text-sm`, children: [_jsx("li", { children: "All your posts and comments" }), _jsx("li", { children: "Your profile and account data" }), _jsx("li", { children: "Your bookmarks and following list" }), _jsx("li", { children: "All images you've uploaded" })] }), _jsx("p", { className: `mb-6 text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-600'} font-medium`, children: "This action cannot be undone." }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => setShowDeleteConfirm(false), disabled: isDeleting, className: `flex-1 px-4 py-2 rounded-lg font-medium transition-all ${theme === 'dark'
                                        ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50'}`, children: "Cancel" }), _jsx("button", { onClick: handleDeleteAccount, disabled: isDeleting, className: `flex-1 px-4 py-2 rounded-lg font-medium transition-all ${theme === 'dark'
                                        ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                                        : 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'}`, children: isDeleting ? 'Deleting...' : 'Delete Account' })] })] }) }))] }));
};
export default EditProfileModal;
