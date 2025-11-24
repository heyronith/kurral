import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { userService } from '../lib/firestore';
import { deleteField } from 'firebase/firestore';
import { useUserStore } from '../store/useUserStore';
const EditProfileModal = ({ open, onClose, user, onUpdate }) => {
    const { updateInterests } = useUserStore();
    const [displayName, setDisplayName] = useState(user.displayName || user.name || '');
    const [userId, setUserId] = useState(user.userId || user.handle || '');
    const [semanticInterests, setSemanticInterests] = useState(user.interests || []);
    const [interestInput, setInterestInput] = useState('');
    const [interestError, setInterestError] = useState('');
    const [bio, setBio] = useState(user.bio || '');
    const [url, setUrl] = useState(user.url || '');
    const [location, setLocation] = useState(user.location || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingUserId, setCheckingUserId] = useState(false);
    // Reset form when user changes or modal opens
    useEffect(() => {
        if (open && user) {
            setDisplayName(user.displayName || user.name || '');
            setUserId(user.userId || user.handle || '');
            setSemanticInterests(user.interests || []);
            setBio(user.bio || '');
            setUrl(user.url || '');
            setLocation(user.location || '');
            setInterestInput('');
            setInterestError('');
            setError('');
        }
    }, [open, user]);
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
    const handleRemoveInterest = (interest) => {
        setSemanticInterests(semanticInterests.filter(i => i !== interest));
    };
    const handleInterestKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddInterest();
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
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8", children: _jsxs("div", { className: "relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-background/95 p-8 shadow-2xl", children: [_jsx("button", { "aria-label": "Close edit profile", onClick: onClose, className: "absolute right-4 top-4 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold text-textMuted transition hover:border-accent hover:text-accent", children: "Close" }), _jsx("h1", { className: "text-2xl font-bold text-textPrimary mb-2", children: "Edit Profile" }), _jsx("p", { className: "text-textMuted mb-6", children: "Update your profile information" }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsxs("label", { htmlFor: "edit-displayName", className: "block text-sm font-medium text-textLabel mb-2", children: ["Display Name ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { id: "edit-displayName", type: "text", value: displayName, onChange: (e) => setDisplayName(e.target.value), required: true, maxLength: 50, className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "Your display name" })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "edit-userId", className: "block text-sm font-medium text-textLabel mb-2", children: ["User ID ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-textMuted", children: "@" }), _jsx("input", { id: "edit-userId", type: "text", value: userId, onChange: (e) => setUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')), required: true, pattern: "[a-zA-Z0-9_]+", minLength: 3, maxLength: 30, className: "flex-1 px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "username" }), checkingUserId && (_jsx("span", { className: "text-xs text-textMuted", children: "Checking..." }))] }), _jsx("p", { className: "mt-1 text-xs text-textMuted", children: "3-30 characters, letters, numbers, and underscores only" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-textLabel mb-2", children: ["Your Interests ", _jsx("span", { className: "text-red-500", children: "*" }), _jsx("span", { className: "text-xs text-textMuted ml-2", children: "(Natural language topics you care about)" })] }), _jsx("div", { className: "mb-3 p-4 bg-background/30 border border-border rounded-lg max-h-48 overflow-y-auto", children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [semanticInterests.length === 0 && (_jsx("p", { className: "text-sm text-textMuted italic", children: "No interests yet. Add topics you want to see in your feed." })), semanticInterests.map((interest) => (_jsxs("button", { type: "button", onClick: () => handleRemoveInterest(interest), className: "px-3 py-1 bg-accent/15 text-accent border border-accent/30 rounded-full text-sm font-medium hover:bg-accent/25 transition-colors flex items-center gap-1", children: [interest, _jsx("span", { className: "text-xs", children: "\u00D7" })] }, interest)))] }) }), _jsxs("div", { className: "flex gap-2 mb-2", children: [_jsx("input", { type: "text", value: interestInput, onChange: (e) => {
                                                setInterestInput(e.target.value);
                                                if (interestError)
                                                    setInterestError('');
                                            }, onKeyDown: handleInterestKeyDown, placeholder: "e.g. react, ai research, startup funding", className: "flex-1 px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all" }), _jsx("button", { type: "button", onClick: handleAddInterest, disabled: loading, className: "px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed", children: "Add" })] }), interestError && (_jsx("p", { className: "text-xs text-red-500 mb-2", children: interestError })), _jsx("p", { className: "text-xs text-textMuted", children: "These interests personalize your feed, news, and help you discover like-minded people. Add topics like \"react development\", \"ai research\", or \"startup funding\"." })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "edit-bio", className: "block text-sm font-medium text-textLabel mb-2", children: "Bio" }), _jsx("textarea", { id: "edit-bio", value: bio, onChange: (e) => setBio(e.target.value), maxLength: 160, rows: 3, className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none", placeholder: "Tell us about yourself..." }), _jsxs("p", { className: "mt-1 text-xs text-textMuted", children: [bio.length, "/160 characters"] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "edit-url", className: "block text-sm font-medium text-textLabel mb-2", children: "Website URL" }), _jsx("input", { id: "edit-url", type: "url", value: url, onChange: (e) => setUrl(e.target.value), className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "https://yourwebsite.com" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "edit-location", className: "block text-sm font-medium text-textLabel mb-2", children: "Location (City)" }), _jsx("input", { id: "edit-location", type: "text", value: location, onChange: (e) => setLocation(e.target.value), maxLength: 50, className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "New York, NY" })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-3 px-4 bg-background/50 border border-border text-textPrimary rounded-lg font-medium hover:bg-background/70 transition-colors", children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading || checkingUserId || semanticInterests.length === 0, className: "flex-1 py-3 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Saving...' : 'Save Changes' })] })] })] }) }));
};
export default EditProfileModal;
