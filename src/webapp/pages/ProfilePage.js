import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { userService, chirpService } from '../lib/firestore';
import { uploadProfilePicture, uploadCoverPhoto, deleteImage } from '../lib/storage';
import { initializeKurralScore } from '../lib/services/kurralScoreService';
import { deleteField } from 'firebase/firestore';
import ChirpCard from '../components/ChirpCard';
import AppLayout from '../components/AppLayout';
import EditProfileModal from '../components/EditProfileModal';
import FollowersFollowingModal from '../components/FollowersFollowingModal';
import ProfileSummaryModal from '../components/ProfileSummaryModal';
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
    const [profileSummaryModalOpen, setProfileSummaryModalOpen] = useState(false);
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
                let user;
                // Handle lookup (starts with @)
                if (userId.startsWith('@')) {
                    const handle = userId.substring(1);
                    user = await userService.getUserByHandle(handle);
                }
                else {
                    // Try to get from cache first
                    user = getUser(userId);
                    if (!user) {
                        // Load from Firestore
                        user = await userService.getUser(userId);
                    }
                }
                if (user) {
                    // Initialize kurralScore if user doesn't have it yet
                    if (!user.kurralScore) {
                        try {
                            await initializeKurralScore(user.id);
                            // Reload user to get updated kurralScore
                            const updatedUser = await userService.getUser(user.id);
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
    const handleDeleteProfilePicture = async () => {
        if (!profileUser || !isOwnProfile || !profileUser.profilePictureUrl)
            return;
        if (!confirm('Are you sure you want to delete your profile picture?')) {
            return;
        }
        setUploadingProfilePicture(true);
        try {
            // Delete from Firebase Storage
            if (profileUser.profilePictureUrl) {
                try {
                    await deleteImage(profileUser.profilePictureUrl);
                }
                catch (deleteError) {
                    console.warn('Failed to delete profile picture from storage:', deleteError);
                    // Continue even if storage delete fails - we still want to remove the URL
                }
            }
            // Remove the URL from Firestore (using any to allow FieldValue from deleteField)
            const updateData = {};
            updateData.profilePictureUrl = deleteField();
            await userService.updateUser(profileUser.id, updateData);
            // Reload updated user
            const updatedUser = await userService.getUser(profileUser.id);
            if (updatedUser) {
                handleProfileUpdate(updatedUser);
            }
        }
        catch (error) {
            console.error('Error deleting profile picture:', error);
            alert(error.message || 'Failed to delete profile picture');
        }
        finally {
            setUploadingProfilePicture(false);
        }
    };
    const handleDeleteCoverPhoto = async () => {
        if (!profileUser || !isOwnProfile || !profileUser.coverPhotoUrl)
            return;
        if (!confirm('Are you sure you want to delete your cover photo?')) {
            return;
        }
        setUploadingCoverPhoto(true);
        try {
            // Delete from Firebase Storage
            if (profileUser.coverPhotoUrl) {
                try {
                    await deleteImage(profileUser.coverPhotoUrl);
                }
                catch (deleteError) {
                    console.warn('Failed to delete cover photo from storage:', deleteError);
                    // Continue even if storage delete fails - we still want to remove the URL
                }
            }
            // Remove the URL from Firestore (using any to allow FieldValue from deleteField)
            const updateData = {};
            updateData.coverPhotoUrl = deleteField();
            await userService.updateUser(profileUser.id, updateData);
            // Reload updated user
            const updatedUser = await userService.getUser(profileUser.id);
            if (updatedUser) {
                handleProfileUpdate(updatedUser);
            }
        }
        catch (error) {
            console.error('Error deleting cover photo:', error);
            alert(error.message || 'Failed to delete cover photo');
        }
        finally {
            setUploadingCoverPhoto(false);
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
    return (_jsxs(AppLayout, { pageTitle: "Profile", wrapContent: true, children: [_jsx("div", { className: "px-4 pt-4 pb-2", children: _jsxs("div", { className: `relative overflow-hidden rounded-[2.5rem] border transition-all duration-500 group ${theme === 'dark'
                        ? 'bg-[#09090b] border-white/10 shadow-2xl shadow-black/50'
                        : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'}`, children: [_jsxs("div", { className: "relative w-full h-56 sm:h-72 bg-gray-900 cursor-pointer overflow-hidden", onMouseEnter: () => isOwnProfile && setHoveringCoverPhoto(true), onMouseLeave: () => setHoveringCoverPhoto(false), children: [profileUser.coverPhotoUrl ? (_jsx("img", { src: profileUser.coverPhotoUrl, alt: "Cover", className: "w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.02]" })) : (_jsx("div", { className: `w-full h-full opacity-40 ${theme === 'dark'
                                        ? 'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-gray-800 via-black to-black'
                                        : 'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-gray-200 via-gray-100 to-white'}` })), _jsx("div", { className: `absolute inset-0 bg-gradient-to-b ${theme === 'dark'
                                        ? 'from-black/0 via-black/20 to-[#09090b]'
                                        : 'from-white/0 via-white/30 to-white'}` }), kurralScoreValue !== null && (_jsxs("div", { className: "absolute bottom-0 left-0 right-0 h-[2px] w-full overflow-hidden", children: [_jsx("div", { className: `h-full ${getScoreBarColor(kurralScoreValue)} opacity-80 blur-[1px]`, style: { width: `${Math.max(5, kurralScoreValue)}%` } }), _jsx("div", { className: `absolute bottom-0 left-0 h-[1px] w-full ${getScoreColor(kurralScoreValue)} shadow-[0_0_15px_rgba(var(--color-primary),0.5)]`, style: { width: `${Math.max(5, kurralScoreValue)}%` } })] })), isOwnProfile && (_jsxs(_Fragment, { children: [_jsx("div", { className: `absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-300 ${hoveringCoverPhoto ? 'opacity-100' : 'opacity-0'}`, children: uploadingCoverPhoto ? (_jsx("span", { className: "text-white font-medium tracking-widest uppercase text-xs animate-pulse", children: "Updating Horizon..." })) : (_jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); coverPhotoInputRef.current?.click(); }, className: "px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-widest rounded-full backdrop-blur-md border border-white/20 transition-all", children: "Change Cover" }), profileUser.coverPhotoUrl && (_jsx("button", { onClick: (e) => { e.stopPropagation(); handleDeleteCoverPhoto(); }, className: "p-2 bg-red-500/20 hover:bg-red-500/40 text-white rounded-full backdrop-blur-md border border-red-500/30 transition-all", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) }))] })) }), _jsx("input", { ref: coverPhotoInputRef, type: "file", accept: "image/*", onChange: handleCoverPhotoChange, className: "hidden", disabled: uploadingCoverPhoto })] }))] }), _jsx("div", { className: "relative px-6 sm:px-10 pb-8", children: _jsxs("div", { className: "flex flex-col sm:flex-row items-start gap-6 -mt-16 sm:-mt-20", children: [_jsxs("div", { className: "relative z-10 flex-shrink-0", children: [_jsxs("div", { className: `relative w-32 h-32 sm:w-40 sm:h-40 rounded-[2rem] p-1.5 shadow-2xl ${theme === 'dark' ? 'bg-[#09090b]' : 'bg-white'}`, onMouseEnter: () => isOwnProfile && setHoveringProfilePicture(true), onMouseLeave: () => setHoveringProfilePicture(false), children: [_jsxs("div", { className: `w-full h-full rounded-[1.6rem] overflow-hidden relative ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`, children: [profileUser.profilePictureUrl ? (_jsx("img", { src: profileUser.profilePictureUrl, alt: displayName, className: "w-full h-full object-cover" })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent text-white text-4xl font-black", children: initials })), isOwnProfile && (_jsx("div", { className: `absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-opacity duration-200 ${hoveringProfilePicture ? 'opacity-100' : 'opacity-0'}`, children: uploadingProfilePicture ? (_jsx("div", { className: "w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" })) : (_jsx("button", { onClick: (e) => { e.stopPropagation(); profilePictureInputRef.current?.click(); }, className: "text-white/90 hover:text-white transform hover:scale-110 transition-transform", children: _jsxs("svg", { className: "w-8 h-8", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }), _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })] }) })) }))] }), isMonetizationEligible && (_jsx("div", { className: "absolute -bottom-1 -right-1 w-7 h-7 bg-[#09090b] rounded-full flex items-center justify-center", children: _jsx("div", { className: "w-4 h-4 bg-green-500 rounded-full border-2 border-[#09090b] shadow-[0_0_10px_rgba(34,197,94,0.6)]" }) }))] }), isOwnProfile && _jsx("input", { ref: profilePictureInputRef, type: "file", accept: "image/*", onChange: handleProfilePictureChange, className: "hidden", disabled: uploadingProfilePicture })] }), _jsxs("div", { className: "flex-1 w-full pt-2 sm:pt-20 min-w-0", children: [_jsxs("div", { className: "flex flex-col lg:flex-row lg:items-start justify-between gap-6", children: [_jsxs("div", { className: "flex-1 space-y-3", children: [_jsxs("div", { children: [_jsx("h1", { className: `text-3xl sm:text-4xl font-black tracking-tight leading-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`, children: displayName }), _jsxs("p", { className: `text-base font-medium mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`, children: ["@", userHandle] })] }), profileUser.bio && (_jsx("p", { className: `text-sm sm:text-base leading-relaxed max-w-2xl ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`, children: profileUser.bio })), _jsxs("div", { className: "flex flex-wrap gap-2 pt-1", children: [profileUser.location && (_jsxs("div", { className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-600'}`, children: [_jsxs("svg", { className: "w-3.5 h-3.5 opacity-70", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" }), _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z" })] }), profileUser.location] })), profileUser.url && (_jsxs("a", { href: profileUser.url, target: "_blank", rel: "noopener noreferrer", className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-white/5 text-primary hover:bg-primary/10' : 'bg-gray-50 text-primary hover:bg-primary/5'}`, children: [_jsx("svg", { className: "w-3.5 h-3.5 opacity-70", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" }) }), profileUser.url.replace(/^https?:\/\//, '')] })), _jsxs("div", { className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme === 'dark' ? 'bg-white/5 text-gray-400' : 'bg-gray-50 text-gray-500'}`, children: [_jsx("svg", { className: "w-3.5 h-3.5 opacity-70", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }), "Joined ", new Date(profileUser.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })] })] })] }), _jsxs("div", { className: "flex flex-col gap-6 lg:items-end", children: [_jsxs("div", { className: "flex items-center gap-6 lg:justify-end", children: [_jsxs("button", { onClick: () => setFollowingModalOpen(true), className: "group text-left lg:text-right", children: [_jsx("p", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`, children: profileUser.following.length }), _jsx("p", { className: `text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`, children: "Following" })] }), _jsx("div", { className: `w-px h-8 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}` }), _jsxs("button", { onClick: () => setFollowersModalOpen(true), className: "group text-left lg:text-right", children: [_jsx("p", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`, children: followersCount }), _jsx("p", { className: `text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`, children: "Followers" })] }), _jsx("div", { className: `w-px h-8 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}` }), _jsxs("div", { className: "text-left lg:text-right", children: [_jsx("p", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`, children: userChirps.length }), _jsx("p", { className: `text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`, children: "Posts" })] })] }), _jsxs("div", { className: "flex flex-col gap-3 lg:items-end", children: [_jsx("div", { className: "flex flex-wrap gap-3 lg:justify-end", children: isOwnProfile ? (_jsx("button", { onClick: () => setIsEditModalOpen(true), className: `px-6 py-2.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${theme === 'dark'
                                                                                ? 'bg-white text-black hover:bg-gray-200'
                                                                                : 'bg-black text-white hover:bg-gray-800'}`, children: "Edit Profile" })) : currentUser && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: handleFollow, className: `px-6 py-2.5 rounded-2xl font-semibold text-sm shadow-lg transition-all active:scale-95 ${following
                                                                                        ? theme === 'dark'
                                                                                            ? 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
                                                                                            : 'bg-gray-100 border border-gray-200 text-gray-900 hover:bg-gray-200'
                                                                                        : 'bg-primary text-white hover:bg-primary/90 hover:shadow-primary/25'}`, children: following ? 'Following' : 'Follow' }), _jsxs("button", { onClick: () => setProfileSummaryModalOpen(true), className: `flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm border transition-all ${theme === 'dark'
                                                                                        ? 'border-white/20 text-white hover:bg-white/5'
                                                                                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`, children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }), _jsx("span", { className: "hidden sm:inline", children: "Summary" })] })] })) }), kurralScoreValue !== null && (_jsxs("div", { className: `flex items-center gap-2 px-3 py-1.5 rounded-xl ${theme === 'dark'
                                                                            ? 'bg-white/5'
                                                                            : 'bg-gray-50'}`, children: [_jsx("div", { className: `w-2 h-2 rounded-full ${getScoreColor(kurralScoreValue)}` }), _jsx("span", { className: `text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`, children: getKurralTier(kurralScoreValue) })] }))] })] })] }), profileUser.interests && profileUser.interests.length > 0 && (_jsxs("div", { className: "mt-8 pt-6 border-t border-dashed border-gray-200 dark:border-white/10", children: [_jsx("p", { className: `text-xs font-bold uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`, children: "Interest Signals" }), _jsx("div", { className: "flex flex-wrap gap-2", children: profileUser.interests.map((interest) => (_jsxs("span", { className: `px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-default ${theme === 'dark'
                                                                ? 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`, children: ["#", interest] }, interest))) })] }))] })] }) })] }) }), _jsxs("div", { className: "px-4 pb-12 mt-6", children: [_jsx("h3", { className: `text-lg font-bold mb-4 px-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`, children: "Recent Posts" }), isLoadingContent ? (_jsx("div", { className: "py-12 text-center", children: _jsx("div", { className: "inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin text-textMuted" }) })) : userChirps.length > 0 ? (_jsx("div", { className: "space-y-4", children: userChirps.map((chirp) => (_jsx(ChirpCard, { chirp: chirp }, chirp.id))) })) : (_jsx("div", { className: `py-16 text-center rounded-2xl border border-dashed ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`, children: _jsx("p", { className: "text-textMuted", children: "No posts yet" }) }))] }), profileUser && (_jsxs(_Fragment, { children: [_jsx(EditProfileModal, { open: isEditModalOpen, onClose: () => setIsEditModalOpen(false), user: profileUser, onUpdate: handleProfileUpdate }), _jsx(FollowersFollowingModal, { open: followersModalOpen, onClose: () => setFollowersModalOpen(false), userId: profileUser.id, mode: "followers" }), _jsx(FollowersFollowingModal, { open: followingModalOpen, onClose: () => setFollowingModalOpen(false), userId: profileUser.id, mode: "following" }), !isOwnProfile && (_jsx(ProfileSummaryModal, { open: profileSummaryModalOpen, onClose: () => setProfileSummaryModalOpen(false), user: profileUser }))] }))] }));
};
export default ProfilePage;
