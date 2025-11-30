import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { userService, chirpService } from '../lib/firestore';
import { uploadProfilePicture, uploadCoverPhoto, deleteImage } from '../lib/storage';
import { initializeKurralScore } from '../lib/services/kurralScoreService';
import ChirpCard from '../components/ChirpCard';
import AppLayout from '../components/AppLayout';
import EditProfileModal from '../components/EditProfileModal';
import FollowersFollowingModal from '../components/FollowersFollowingModal';
const getKurralTier = (score) => {
    if (score >= 88)
        return 'Excellent';
    if (score >= 77)
        return 'Good';
    if (score >= 65)
        return 'Fair';
    if (score >= 53)
        return 'Poor';
    return 'Very Poor';
};
const getScoreColor = (score) => {
    if (score >= 88)
        return 'bg-green-500';
    if (score >= 77)
        return 'bg-blue-500';
    if (score >= 65)
        return 'bg-yellow-500';
    if (score >= 53)
        return 'bg-orange-500';
    return 'bg-red-500';
};
const getScoreTextColor = (score) => {
    if (score >= 88)
        return 'text-green-500';
    if (score >= 77)
        return 'text-blue-500';
    if (score >= 65)
        return 'text-yellow-500';
    if (score >= 53)
        return 'text-orange-500';
    return 'text-red-500';
};
const getScoreBarColor = (score) => {
    if (score >= 88)
        return 'bg-gradient-to-r from-green-500 to-green-600';
    if (score >= 77)
        return 'bg-gradient-to-r from-blue-500 to-blue-600';
    if (score >= 65)
        return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    if (score >= 53)
        return 'bg-gradient-to-r from-orange-500 to-orange-600';
    return 'bg-gradient-to-r from-red-500 to-red-600';
};
const getScoreStrokeColor = (score) => {
    if (score >= 88)
        return '#22c55e';
    if (score >= 77)
        return '#3b82f6';
    if (score >= 65)
        return '#eab308';
    if (score >= 53)
        return '#f97316';
    return '#ef4444';
};
const ProfilePage = () => {
    const { userId } = useParams();
    const { currentUser, getUser, loadUser, followUser, unfollowUser, isFollowing, setCurrentUser, addUser, users } = useUserStore();
    const { theme } = useThemeStore();
    const [profileUser, setProfileUser] = useState(null);
    const [userChirps, setUserChirps] = useState([]);
    const [followersCount, setFollowersCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
    const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
    const [hoveringProfilePicture, setHoveringProfilePicture] = useState(false);
    const [hoveringCoverPhoto, setHoveringCoverPhoto] = useState(false);
    const [followersModalOpen, setFollowersModalOpen] = useState(false);
    const [followingModalOpen, setFollowingModalOpen] = useState(false);
    const profilePictureInputRef = useRef(null);
    const coverPhotoInputRef = useRef(null);
    useEffect(() => {
        const loadProfile = async () => {
            if (!userId) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                // Try to get from cache first
                let user = getUser(userId);
                if (!user) {
                    // Load from Firestore
                    const firestoreUser = await userService.getUser(userId);
                    if (firestoreUser) {
                        user = firestoreUser;
                    }
                }
                if (user) {
                    // Initialize kurralScore if user doesn't have it yet
                    if (!user.kurralScore) {
                        try {
                            await initializeKurralScore(user.id);
                            // Reload user to get updated kurralScore
                            const updatedUser = await userService.getUser(userId);
                            if (updatedUser) {
                                user = updatedUser;
                            }
                        }
                        catch (error) {
                            console.error('Error initializing kurralScore:', error);
                            // Continue with user even if initialization fails
                        }
                    }
                    setProfileUser(user);
                }
            }
            catch (error) {
                console.error('Error loading profile:', error);
            }
            finally {
                setIsLoading(false);
            }
        };
        loadProfile();
    }, [userId, getUser]);
    useEffect(() => {
        const loadContent = async () => {
            if (!profileUser)
                return;
            try {
                setIsLoadingContent(true);
                const chirps = await chirpService.getChirpsByAuthor(profileUser.id);
                setUserChirps(chirps);
                // Load authors for chirps
                const authorIds = new Set(chirps.map(c => c.authorId));
                for (const authorId of authorIds) {
                    await loadUser(authorId);
                }
                // Calculate followers count (users who follow this profile user)
                const followers = Object.values(users).filter(user => user.following && user.following.includes(profileUser.id));
                setFollowersCount(followers.length);
            }
            catch (error) {
                console.error('Error loading content:', error);
            }
            finally {
                setIsLoadingContent(false);
            }
        };
        loadContent();
    }, [profileUser, users, loadUser]);
    const handleFollow = async () => {
        if (!profileUser || !currentUser)
            return;
        if (isFollowing(profileUser.id)) {
            await unfollowUser(profileUser.id);
        }
        else {
            await followUser(profileUser.id);
        }
    };
    const handleProfileUpdate = async (updatedUser) => {
        setProfileUser(updatedUser);
        // Update in store cache
        addUser(updatedUser);
        // If it's the current user, update the current user in store
        if (currentUser && updatedUser.id === currentUser.id) {
            setCurrentUser(updatedUser);
        }
    };
    const handleProfilePictureChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !profileUser || !isOwnProfile)
            return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Profile picture must be less than 2MB');
            return;
        }
        setUploadingProfilePicture(true);
        try {
            // Delete old profile picture if it exists
            if (profileUser.profilePictureUrl) {
                try {
                    await deleteImage(profileUser.profilePictureUrl);
                }
                catch (deleteError) {
                    console.warn('Failed to delete old profile picture:', deleteError);
                }
            }
            const downloadURL = await uploadProfilePicture(file, profileUser.id);
            // Update user in Firestore
            await userService.updateUser(profileUser.id, {
                profilePictureUrl: downloadURL,
            });
            // Reload updated user
            const updatedUser = await userService.getUser(profileUser.id);
            if (updatedUser) {
                handleProfileUpdate(updatedUser);
            }
        }
        catch (uploadError) {
            console.error('Error uploading profile picture:', uploadError);
            alert(uploadError.message || 'Failed to upload profile picture');
        }
        finally {
            setUploadingProfilePicture(false);
            if (profilePictureInputRef.current) {
                profilePictureInputRef.current.value = '';
            }
        }
    };
    const handleCoverPhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !profileUser || !isOwnProfile)
            return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            alert('Cover photo must be less than 3MB');
            return;
        }
        setUploadingCoverPhoto(true);
        try {
            // Delete old cover photo if it exists
            if (profileUser.coverPhotoUrl) {
                try {
                    await deleteImage(profileUser.coverPhotoUrl);
                }
                catch (deleteError) {
                    console.warn('Failed to delete old cover photo:', deleteError);
                }
            }
            const downloadURL = await uploadCoverPhoto(file, profileUser.id);
            // Update user in Firestore
            await userService.updateUser(profileUser.id, {
                coverPhotoUrl: downloadURL,
            });
            // Reload updated user
            const updatedUser = await userService.getUser(profileUser.id);
            if (updatedUser) {
                handleProfileUpdate(updatedUser);
            }
        }
        catch (uploadError) {
            console.error('Error uploading cover photo:', uploadError);
            alert(uploadError.message || 'Failed to upload cover photo');
        }
        finally {
            setUploadingCoverPhoto(false);
            if (coverPhotoInputRef.current) {
                coverPhotoInputRef.current.value = '';
            }
        }
    };
    if (isLoading) {
        return (_jsx("div", { className: `min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-black' : 'bg-background'}`, children: _jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Loading..." }) }));
    }
    if (!profileUser) {
        return (_jsx("div", { className: `min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-black' : 'bg-background'}`, children: _jsxs("div", { className: "text-center", children: [_jsx("h1", { className: `text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`, children: "User not found" }), _jsx(Link, { to: "/app", className: "text-primary hover:underline", children: "Go back to app" })] }) }));
    }
    const isOwnProfile = currentUser?.id === profileUser.id;
    const following = isFollowing(profileUser.id);
    const displayName = profileUser.displayName || profileUser.name;
    const userHandle = profileUser.userId || profileUser.handle;
    const kurralScoreValue = profileUser.kurralScore?.score ?? null;
    const accountAgeDays = Math.floor((Date.now() - profileUser.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const meetsScoreThreshold = kurralScoreValue !== null && kurralScoreValue >= 77;
    const meetsAccountAgeThreshold = accountAgeDays >= 30;
    const isMonetizationEligible = meetsScoreThreshold && meetsAccountAgeThreshold;
    const initials = displayName
        .split(' ')
        .map((part) => part[0]?.toUpperCase())
        .join('')
        .slice(0, 2);
    return (_jsxs(AppLayout, { pageTitle: "Profile", wrapContent: true, children: [_jsxs("div", { className: `border-b ${theme === 'dark' ? 'border-white/10' : 'border-border'}`, children: [_jsxs("div", { className: "relative w-full h-48 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/30 cursor-pointer group", onMouseEnter: () => isOwnProfile && setHoveringCoverPhoto(true), onMouseLeave: () => setHoveringCoverPhoto(false), onClick: () => isOwnProfile && coverPhotoInputRef.current?.click(), children: [profileUser.coverPhotoUrl ? (_jsx("img", { src: profileUser.coverPhotoUrl, alt: `${displayName}'s cover photo`, className: "w-full h-full object-cover" })) : null, isOwnProfile && (_jsxs(_Fragment, { children: [_jsx("div", { className: `absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${hoveringCoverPhoto ? 'opacity-100' : 'opacity-0'}`, children: _jsx("div", { className: "text-white text-sm font-medium", children: uploadingCoverPhoto ? 'Uploading...' : 'Change cover photo' }) }), _jsx("input", { ref: coverPhotoInputRef, type: "file", accept: "image/*", onChange: handleCoverPhotoChange, className: "hidden", disabled: uploadingCoverPhoto })] }))] }), _jsx("div", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-start justify-between gap-4 mb-4", children: [_jsxs("div", { className: "flex flex-col items-start gap-3 flex-1 min-w-0", children: [_jsxs("div", { className: "relative cursor-pointer group -mt-16 flex-shrink-0", onMouseEnter: () => isOwnProfile && setHoveringProfilePicture(true), onMouseLeave: () => setHoveringProfilePicture(false), onClick: () => isOwnProfile && profilePictureInputRef.current?.click(), children: [_jsxs("div", { className: `flex h-24 w-24 items-center justify-center rounded-full ${theme === 'dark' ? 'bg-black' : 'bg-background border-4 border-background'} overflow-hidden z-10 relative`, children: [profileUser.profilePictureUrl ? (_jsx("img", { src: profileUser.profilePictureUrl, alt: `${displayName}'s profile picture`, className: "w-full h-full object-cover" })) : (_jsx("div", { className: "flex h-full w-full items-center justify-center bg-primary/20 text-2xl font-semibold text-primary", children: initials })), isOwnProfile && (_jsx("div", { className: `absolute inset-0 bg-black/60 rounded-full flex items-center justify-center transition-opacity duration-200 ${hoveringProfilePicture ? 'opacity-100' : 'opacity-0'}`, children: _jsx("div", { className: "text-white text-xs font-medium text-center px-2", children: uploadingProfilePicture ? 'Uploading...' : 'Change' }) }))] }), isOwnProfile && (_jsx("input", { ref: profilePictureInputRef, type: "file", accept: "image/*", onChange: handleProfilePictureChange, className: "hidden", disabled: uploadingProfilePicture }))] }), _jsxs("div", { className: "flex-1 min-w-0 w-full relative z-10 -mt-12 pt-16", children: [_jsx("h2", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-0.5`, children: displayName }), _jsxs("p", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-3`, children: ["@", userHandle] }), _jsxs("div", { className: "flex items-center gap-4 text-sm mb-3 flex-wrap", children: [_jsxs("button", { onClick: () => setFollowingModalOpen(true), className: "flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer", children: [_jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: profileUser.following.length }), _jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Following" })] }), _jsxs("button", { onClick: () => setFollowersModalOpen(true), className: "flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer", children: [_jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: followersCount }), _jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Followers" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: userChirps.length }), _jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Posts" })] })] }), profileUser.reputation && Object.keys(profileUser.reputation).length > 0 && (_jsxs("div", { className: "mb-3", children: [_jsx("div", { className: `text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`, children: "Reputation by Domain" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: Object.entries(profileUser.reputation)
                                                                .sort(([, a], [, b]) => b - a)
                                                                .slice(0, 5)
                                                                .map(([domain, score]) => (_jsxs("div", { className: `px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-white border-white/10' : 'bg-backgroundElevated/60 text-textPrimary border-border/50'} rounded border text-xs`, title: `${domain}: ${(score * 100).toFixed(0)}`, children: [_jsx("span", { className: "font-medium capitalize", children: domain }), _jsx("span", { className: "ml-1 text-accent", children: (score * 100).toFixed(0) })] }, domain))) })] })), profileUser.bio && (_jsx("p", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2 whitespace-pre-wrap`, children: profileUser.bio })), (profileUser.location || profileUser.url) && (_jsxs("div", { className: `flex flex-wrap gap-3 text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-2`, children: [profileUser.location && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u2022" }), _jsx("span", { children: profileUser.location })] })), profileUser.url && (_jsxs("a", { href: profileUser.url, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-1 text-primary hover:underline", children: [_jsx("span", { children: "\uD83D\uDD17" }), _jsx("span", { className: "truncate max-w-[200px]", children: profileUser.url.replace(/^https?:\/\//, '') })] }))] })), profileUser.interests && profileUser.interests.length > 0 && (_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [profileUser.interests.slice(0, 5).map((interest) => (_jsx("span", { className: "px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-xs", title: interest, children: interest }, interest))), profileUser.interests.length > 5 && (_jsxs("span", { className: "px-2 py-0.5 text-xs text-textMuted", children: ["+", profileUser.interests.length - 5] }))] }))] })] }), _jsxs("div", { className: "flex-shrink-0 pt-2 flex flex-col gap-2", children: [isOwnProfile && (_jsx("button", { onClick: () => setIsEditModalOpen(true), className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-background/50 border-border text-textPrimary hover:bg-background/70'}`, children: "Edit Profile" })), !isOwnProfile && currentUser && (_jsx("button", { onClick: handleFollow, className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${following
                                                ? theme === 'dark'
                                                    ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                                                    : 'bg-background/50 border border-border text-textPrimary hover:bg-background/70'
                                                : 'bg-primary text-white hover:bg-primary/90'}`, children: following ? 'Following' : 'Follow' })), profileUser.kurralScore && kurralScoreValue !== null && (_jsxs("div", { className: `px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-backgroundElevated/40 border-border/60'} w-full min-w-[200px]`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${getScoreColor(kurralScoreValue)}` }), _jsx("span", { className: `text-xs font-medium ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "Kurral Score" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex items-center gap-2", children: [1, 2, 3, 4, 5].map((level) => {
                                                                const threshold = level * 20;
                                                                const isActive = kurralScoreValue >= threshold - 20;
                                                                return (_jsx("div", { className: `w-2.5 h-2.5 rounded-full transition-all duration-300 ${isActive
                                                                        ? getScoreColor(kurralScoreValue)
                                                                        : theme === 'dark' ? 'bg-white/10' : 'bg-border/40'}` }, level));
                                                            }) }), isMonetizationEligible && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-green-500 animate-pulse" }), _jsx("div", { className: `w-1 h-1 rounded-full ${theme === 'dark' ? 'bg-green-400' : 'bg-green-600'}` })] }))] })] }))] })] }) })] }), _jsx("div", { className: "max-h-[calc(100vh-350px)] overflow-y-auto", children: isLoadingContent ? (_jsx("div", { className: "p-8 text-center text-textMuted", children: "Loading..." })) : userChirps.length > 0 ? (userChirps.map((chirp) => (_jsx(ChirpCard, { chirp: chirp }, chirp.id)))) : (_jsx("div", { className: "p-8 text-center text-textMuted", children: _jsx("p", { children: "No posts yet" }) })) }), profileUser && (_jsx(EditProfileModal, { open: isEditModalOpen, onClose: () => setIsEditModalOpen(false), user: profileUser, onUpdate: handleProfileUpdate })), profileUser && (_jsxs(_Fragment, { children: [_jsx(FollowersFollowingModal, { open: followersModalOpen, onClose: () => setFollowersModalOpen(false), userId: profileUser.id, mode: "followers" }), _jsx(FollowersFollowingModal, { open: followingModalOpen, onClose: () => setFollowingModalOpen(false), userId: profileUser.id, mode: "following" })] }))] }));
};
export default ProfilePage;
