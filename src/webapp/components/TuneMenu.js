import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
const TuneMenu = ({ authorId, topic, onClose }) => {
    const { forYouConfig, setFollowingWeight, addLikedTopic, addMutedTopic, } = useConfigStore();
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    const handleMoreFromPerson = () => {
        // Increase following weight
        const weights = ['none', 'light', 'medium', 'heavy'];
        const currentIndex = weights.indexOf(forYouConfig.followingWeight);
        if (currentIndex < weights.length - 1) {
            setFollowingWeight(weights[currentIndex + 1]);
        }
        else {
            setFollowingWeight('heavy');
        }
        onClose();
    };
    const handleMoreAboutTopic = () => {
        addLikedTopic(topic);
        onClose();
    };
    const handleLessLikeThis = () => {
        addMutedTopic(topic);
        onClose();
    };
    return (_jsx("div", { ref: menuRef, className: "absolute right-0 top-8 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[200px]", children: _jsxs("div", { className: "py-1", children: [_jsx("button", { onClick: handleMoreFromPerson, className: "w-full text-left px-4 py-2 text-sm text-textPrimary hover:bg-background/50 transition-colors", children: "More from this person" }), _jsxs("button", { onClick: handleMoreAboutTopic, className: "w-full text-left px-4 py-2 text-sm text-textPrimary hover:bg-background/50 transition-colors", children: ["More about #", topic] }), _jsx("button", { onClick: handleLessLikeThis, className: "w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-background/50 transition-colors", children: "Less like this" })] }) }));
};
export default TuneMenu;
