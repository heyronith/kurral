import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
// Animated audience targeting demo
const AudienceTargetingDemo = () => {
    const [displayedText, setDisplayedText] = useState('');
    const [activeAudiences, setActiveAudiences] = useState([]);
    const [stage, setStage] = useState('typing');
    const [showCursor, setShowCursor] = useState(true);
    const [showClickCursor, setShowClickCursor] = useState(false);
    const [showNodes, setShowNodes] = useState(false);
    const fullText = 'Latest policy analysis: The new healthcare bill addresses key gaps in coverage. Here\'s what it means for small businesses...';
    const typingSpeed = 30;
    const audiences = [
        { id: 'followers', label: 'Followers' },
        { id: 'politics', label: 'Politics' },
        { id: 'policy', label: 'Policy' },
        { id: 'news', label: 'News' },
    ];
    useEffect(() => {
        let timeoutId;
        let currentIndex = 0;
        const cycle = () => {
            // Stage 1: Typing the post
            setStage('typing');
            setDisplayedText('');
            setActiveAudiences([]);
            setShowCursor(true);
            setShowClickCursor(false);
            setShowNodes(false);
            currentIndex = 0;
            const typeText = () => {
                if (currentIndex < fullText.length) {
                    setDisplayedText(fullText.slice(0, currentIndex + 1));
                    currentIndex++;
                    timeoutId = setTimeout(typeText, typingSpeed);
                }
                else {
                    // Wait, then show cursor clicking "Tuned"
                    setTimeout(() => {
                        setShowCursor(false);
                        setStage('selecting');
                        setShowClickCursor(true);
                        // After click animation, show post button
                        setTimeout(() => {
                            setShowClickCursor(false);
                            setStage('posting');
                            // After posting, analyze
                            setTimeout(() => {
                                setStage('analyzing');
                                // Start analyzing
                                setTimeout(() => {
                                    setStage('targeting');
                                    setShowNodes(true);
                                    // Activate audiences one by one
                                    const activateAudiences = () => {
                                        setActiveAudiences(['followers']);
                                        setTimeout(() => setActiveAudiences(['followers', 'politics']), 200);
                                        setTimeout(() => setActiveAudiences(['followers', 'politics', 'policy']), 400);
                                        setTimeout(() => {
                                            setActiveAudiences(['followers', 'politics', 'policy', 'news']);
                                            setStage('complete');
                                            // Reset after showing complete
                                            setTimeout(() => {
                                                cycle();
                                            }, 3000);
                                        }, 600);
                                    };
                                    activateAudiences();
                                }, 1000);
                            }, 600);
                        }, 800);
                    }, 1000);
                }
            };
            typeText();
        };
        cycle();
        return () => {
            if (timeoutId)
                clearTimeout(timeoutId);
        };
    }, [fullText]);
    return (_jsx("div", { className: "relative w-full flex items-center justify-center py-4", children: _jsxs("div", { className: "relative w-full max-w-sm space-y-2", children: [_jsxs("div", { className: `rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 space-y-2 transition-all duration-700 ease-out ${showNodes ? '-translate-y-6' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-full bg-accent/20 border border-accent flex items-center justify-center text-[10px] font-semibold text-accent", children: "JS" }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsx("span", { className: "text-[11px] font-semibold text-textPrimary", children: "Jordan Smith" }), _jsx("span", { className: "text-[9px] text-textMuted", children: "@jordansmith" }), _jsx("span", { className: "text-[9px] text-textMuted", children: "\u00B7" }), _jsx("span", { className: "text-[9px] text-textMuted", children: "2m" })] }) }), _jsx("div", { className: "px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30", children: _jsx("span", { className: "text-[9px] font-medium text-red-400", children: "#politics" }) })] }), _jsxs("div", { className: "text-[11px] text-textPrimary leading-relaxed min-h-[2rem]", children: [displayedText, showCursor && stage === 'typing' && (_jsx("span", { className: "inline-block w-0.5 h-3 bg-accent ml-1 animate-pulse" }))] }), _jsxs("div", { className: "flex items-center justify-between pt-1.5 border-t border-white/10 transition-all duration-300", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-[9px] text-textMuted", children: "Reach:" }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: `px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${stage === 'selecting' || stage === 'posting' || stage === 'analyzing' || stage === 'targeting' || stage === 'complete'
                                                        ? 'bg-white/5 text-textMuted border border-white/10'
                                                        : 'bg-accent/10 text-accent border border-accent/30'}`, children: "For All" }), _jsxs("button", { className: `px-1.5 py-0.5 rounded text-[9px] font-medium transition-all relative ${stage === 'selecting' || stage === 'posting' || stage === 'analyzing' || stage === 'targeting' || stage === 'complete'
                                                        ? 'bg-accent/20 text-accent border-2 border-accent shadow-md shadow-accent/20 scale-105'
                                                        : 'bg-white/5 text-textMuted border border-white/10'}`, children: ["Tuned", showClickCursor && (_jsx("div", { className: "absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-black rounded-sm animate-ping" }))] })] })] }), _jsx("button", { className: `px-3 py-1 rounded-lg text-[10px] font-semibold transition-all duration-300 ${stage === 'posting'
                                        ? 'bg-accent text-white shadow-lg shadow-accent/30 scale-105'
                                        : showNodes
                                            ? 'bg-accent/20 text-accent border border-accent/30'
                                            : 'bg-white/5 text-textMuted border border-white/10'}`, children: showNodes ? 'Posted' : 'Post' })] }), stage === 'analyzing' && (_jsxs("div", { className: "flex items-center gap-1.5 pt-1.5 border-t border-white/10 animate-fadeIn", children: [_jsxs("div", { className: "flex gap-1", children: [_jsx("div", { className: "w-1 h-1 bg-accent rounded-full animate-bounce", style: { animationDelay: '0ms' } }), _jsx("div", { className: "w-1 h-1 bg-accent rounded-full animate-bounce", style: { animationDelay: '150ms' } }), _jsx("div", { className: "w-1 h-1 bg-accent rounded-full animate-bounce", style: { animationDelay: '300ms' } })] }), _jsx("span", { className: "text-[9px] text-textMuted", children: "Analyzing content..." })] })), stage === 'complete' && (_jsxs("div", { className: "flex items-center gap-1.5 pt-1.5 border-t border-white/10 animate-fadeIn", children: [_jsx("svg", { className: "w-2.5 h-2.5 text-green-500", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-[9px] text-green-400", children: "Reach: Tuned" })] }))] }), showNodes && (_jsxs("div", { className: "relative animate-fadeIn", children: [_jsx("div", { className: "absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-4 bg-gradient-to-b from-accent/30 to-transparent" }), _jsx("div", { className: "grid grid-cols-2 gap-2 pt-3", children: audiences.map((audience, index) => {
                                const isActive = activeAudiences.includes(audience.id);
                                const delay = index * 150;
                                return (_jsxs("div", { className: `flex flex-col items-center gap-1 transition-all duration-600 ease-out ${isActive ? 'opacity-100 scale-100' : 'opacity-20 scale-90'}`, style: {
                                        transitionDelay: isActive ? `${delay}ms` : '0ms',
                                        transform: isActive ? 'translateY(0)' : 'translateY(8px)'
                                    }, children: [_jsx("div", { className: `w-0.5 h-4 transition-all duration-600 ${isActive
                                                ? 'bg-gradient-to-b from-accent to-accent/50'
                                                : 'bg-gradient-to-b from-white/10 to-transparent'}` }), _jsxs("div", { className: `relative w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-600 ease-out ${isActive
                                                ? 'bg-accent/20 border-accent shadow-md shadow-accent/20 scale-105'
                                                : 'bg-white/5 border-white/10'}`, children: [_jsx("span", { className: `text-[9px] font-medium text-center transition-colors duration-500 ${isActive ? 'text-accent' : 'text-textMuted'}`, children: audience.label }), isActive && (_jsx("div", { className: "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-black flex items-center justify-center animate-scaleIn", children: _jsx("svg", { className: "w-1.5 h-1.5 text-white", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z", clipRule: "evenodd" }) }) }))] })] }, audience.id));
                            }) })] }))] }) }));
};
// Value-Based Monetization Dashboard Demo - Clean & Compact
const ValueBasedMonetizationDemo = () => {
    const [kurralScore, setKurralScore] = useState(0);
    const [totalPosts, setTotalPosts] = useState(0);
    const [avgPostValue, setAvgPostValue] = useState(0);
    const [totalComments, setTotalComments] = useState(0);
    const [avgDiscussionQuality, setAvgDiscussionQuality] = useState(0);
    useEffect(() => {
        let scoreInterval;
        let metricsInterval;
        let timeoutIds = [];
        const cycle = () => {
            // Reset all values
            setKurralScore(0);
            setTotalPosts(0);
            setAvgPostValue(0);
            setTotalComments(0);
            setAvgDiscussionQuality(0);
            // Animate Kurral Score (0 to 82)
            let currentScore = 0;
            scoreInterval = setInterval(() => {
                currentScore += 2.5;
                if (currentScore >= 82) {
                    clearInterval(scoreInterval);
                    setKurralScore(82);
                    // After score completes, animate KPIs
                    const timeout1 = setTimeout(() => {
                        let currentPosts = 0;
                        let currentAvgValue = 0;
                        let currentComments = 0;
                        let currentQuality = 0;
                        metricsInterval = setInterval(() => {
                            currentPosts += 1.2;
                            currentAvgValue += 0.8;
                            currentComments += 0.6;
                            currentQuality += 0.5;
                            if (currentPosts >= 47) {
                                clearInterval(metricsInterval);
                                setTotalPosts(47);
                                setAvgPostValue(72);
                                setTotalComments(23);
                                setAvgDiscussionQuality(68);
                                // Reset after showing complete metrics
                                const timeout2 = setTimeout(() => {
                                    cycle();
                                }, 3000);
                                timeoutIds.push(timeout2);
                            }
                            else {
                                setTotalPosts(Math.round(currentPosts));
                                setAvgPostValue(Math.round(currentAvgValue));
                                setTotalComments(Math.round(currentComments));
                                setAvgDiscussionQuality(Math.round(currentQuality));
                            }
                        }, 30);
                    }, 800);
                    timeoutIds.push(timeout1);
                }
                else {
                    setKurralScore(currentScore);
                }
            }, 20);
        };
        cycle();
        return () => {
            if (scoreInterval)
                clearInterval(scoreInterval);
            if (metricsInterval)
                clearInterval(metricsInterval);
            timeoutIds.forEach(id => clearTimeout(id));
        };
    }, []);
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
    return (_jsx("div", { className: "relative w-full flex items-center justify-center py-4", children: _jsxs("div", { className: "relative w-full max-w-sm space-y-4", children: [_jsxs("div", { className: "space-y-2.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-1.5 h-1.5 rounded-full ${getScoreColor(kurralScore)} transition-colors duration-300` }), _jsx("span", { className: "text-[10px] font-medium text-textMuted uppercase tracking-wide", children: "Kural Score" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex items-center gap-1.5", children: [1, 2, 3, 4, 5].map((level) => {
                                        const threshold = level * 20;
                                        const isActive = kurralScore >= threshold - 20;
                                        return (_jsx("div", { className: `w-2.5 h-2.5 rounded-full transition-all duration-300 ${isActive
                                                ? `${getScoreColor(kurralScore)} shadow-sm`
                                                : 'bg-white/10'}` }, level));
                                    }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-2xl font-bold text-accent", children: Math.round(kurralScore) }), kurralScore >= 77 && (_jsxs("div", { className: "flex items-center gap-0.5", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" }), _jsx("div", { className: "w-1 h-1 rounded-full bg-green-400" })] }))] })] })] }), kurralScore > 0 && (_jsxs("div", { className: "grid grid-cols-2 gap-3 animate-fadeIn", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx("div", { className: "text-[9px] text-textMuted", children: "Posts" }), _jsx("div", { className: "text-xl font-bold text-textPrimary", children: totalPosts }), _jsxs("div", { className: "text-[9px] text-accent/80", children: ["Avg: ", avgPostValue] })] }), _jsxs("div", { className: "space-y-0.5", children: [_jsx("div", { className: "text-[9px] text-textMuted", children: "Comments" }), _jsx("div", { className: "text-xl font-bold text-textPrimary", children: totalComments }), _jsxs("div", { className: "text-[9px] text-accent/80", children: ["Quality: ", avgDiscussionQuality, "%"] })] })] }))] }) }));
};
// Animated typing component for Algorithm Control
const TypingAnimation = () => {
    const [displayedText, setDisplayedText] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [isTyping, setIsTyping] = useState(true);
    const [showProcessing, setShowProcessing] = useState(false);
    const fullText = 'Show more posts about AI and startups';
    const typingSpeed = 40; // milliseconds per character
    useEffect(() => {
        if (!isTyping || showSuccess)
            return;
        let timeoutId;
        let currentIndex = 0;
        const typeText = () => {
            if (currentIndex < fullText.length) {
                setDisplayedText(fullText.slice(0, currentIndex + 1));
                currentIndex++;
                timeoutId = setTimeout(typeText, typingSpeed);
            }
            else {
                // Wait a bit, then show processing
                setTimeout(() => {
                    setIsTyping(false);
                    setShowProcessing(true);
                    // After processing, show success
                    setTimeout(() => {
                        setShowProcessing(false);
                        setShowSuccess(true);
                        // Reset after showing success for 3.5 seconds
                        setTimeout(() => {
                            setDisplayedText('');
                            setShowSuccess(false);
                            setIsTyping(true);
                        }, 3500);
                    }, 1200);
                }, 800);
            }
        };
        typeText();
        return () => {
            if (timeoutId)
                clearTimeout(timeoutId);
        };
    }, [isTyping, showSuccess, fullText]);
    return (_jsx("div", { className: "relative w-full flex items-center justify-center py-4", children: _jsx("div", { className: "relative w-full max-w-sm space-y-2.5", children: _jsxs("div", { className: "rounded-xl border border-accent/40 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent backdrop-blur-xl p-4 space-y-3 shadow-lg shadow-accent/10 relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 opacity-50 animate-pulse" }), _jsxs("div", { className: "flex items-center gap-2 relative z-10", children: [_jsx("div", { className: "p-1.5 rounded-lg bg-accent/20 border border-accent/30", children: _jsx("svg", { className: "w-3 h-3 text-accent", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }) }), _jsx("div", { children: _jsx("span", { className: "text-[10px] font-semibold text-accent uppercase tracking-wider", children: "Experience Control" }) })] }), _jsxs("div", { className: "relative z-10", children: [_jsx("div", { className: `w-full rounded-lg bg-white/5 border-2 transition-all duration-300 px-3 py-2.5 pr-10 text-xs text-textPrimary min-h-[40px] flex items-center ${showProcessing
                                    ? 'border-accent/50 bg-accent/10 shadow-lg shadow-accent/20'
                                    : 'border-accent/30 hover:border-accent/50'}`, children: showProcessing ? (_jsxs("div", { className: "flex items-center gap-2 w-full", children: [_jsxs("div", { className: "flex gap-1", children: [_jsx("div", { className: "w-1.5 h-1.5 bg-accent rounded-full animate-bounce", style: { animationDelay: '0ms' } }), _jsx("div", { className: "w-1.5 h-1.5 bg-accent rounded-full animate-bounce", style: { animationDelay: '150ms' } }), _jsx("div", { className: "w-1.5 h-1.5 bg-accent rounded-full animate-bounce", style: { animationDelay: '300ms' } })] }), _jsx("span", { className: "text-[10px] text-textMuted", children: "Processing..." })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-textPrimary", children: displayedText }), isTyping && (_jsx("span", { className: "inline-block w-0.5 h-3.5 bg-accent ml-1 animate-pulse shadow-sm shadow-accent/50" }))] })) }), _jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2", children: showProcessing ? (_jsx("div", { className: "w-2.5 h-2.5 bg-accent rounded-full animate-pulse shadow-lg shadow-accent/50" })) : (_jsx("div", { className: "w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-sm" })) })] }), showSuccess && (_jsx("div", { className: "relative z-20 animate-slideUp", children: _jsxs("div", { className: "flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-green-500/20 to-green-500/10 border-2 border-green-500/40 backdrop-blur-sm shadow-lg shadow-green-500/20", children: [_jsxs("div", { className: "relative flex-shrink-0", children: [_jsx("div", { className: "absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75" }), _jsx("svg", { className: "w-4 h-4 text-green-400 relative", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) })] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-xs font-semibold text-green-400", children: "Your custom experience is ready" }), _jsx("div", { className: "text-[10px] text-green-500/70 mt-0.5", children: "Experience updated \u2022 Algorithm adjusted" })] })] }) })), _jsxs("div", { className: "space-y-1.5 pt-2 border-t border-white/10 relative z-10", children: [_jsx("div", { className: "text-[10px] text-textMuted mb-2 font-medium", children: "Try these commands:" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: ['Mute politics', 'Boost conversations', 'Show more from people I follow'].map((cmd, i) => (_jsxs("button", { className: "group px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-accent/40 hover:bg-accent/10 transition-all duration-200 text-[10px] text-textMuted hover:text-textPrimary hover:scale-105 hover:shadow-md hover:shadow-accent/20", style: { transitionDelay: `${i * 50}ms` }, children: [_jsx("span", { className: "relative z-10", children: cmd }), _jsx("div", { className: "absolute inset-0 rounded-lg bg-gradient-to-r from-accent/0 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity" })] }, cmd))) })] })] }) }) }));
};
// Transparent by Design Demo - Shows why posts appear
const TransparencyDemo = () => {
    const [activePost, setActivePost] = useState(0);
    const posts = [
        {
            author: 'Sarah Chen',
            handle: '@sarahchen',
            text: 'Just shipped our new AI feature. Here\'s what we learned about scaling embeddings...',
            reason: 'Because you follow @sarahchen',
            icon: '👥',
        },
        {
            author: 'DevTools Weekly',
            handle: '@devtools',
            text: 'The 5 React patterns that will change how you think about state management...',
            reason: 'Matches your interest "react"',
            icon: '🎯',
        },
        {
            author: 'Alex Rivera',
            handle: '@alexr',
            text: 'Unpopular opinion: Most startup advice is survivorship bias. Here\'s what actually works...',
            reason: '87% profile match + active discussion',
            icon: '💬',
        },
    ];
    useEffect(() => {
        const interval = setInterval(() => {
            setActivePost((prev) => (prev + 1) % posts.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [posts.length]);
    const currentPost = posts[activePost];
    return (_jsx("div", { className: "relative w-full flex items-center justify-center py-4", children: _jsxs("div", { className: "relative w-full max-w-sm space-y-3", children: [_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 space-y-2 transition-all duration-500", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-7 h-7 rounded-full bg-accent/20 border border-accent flex items-center justify-center text-[10px] font-semibold text-accent", children: currentPost.author.split(' ').map(n => n[0]).join('') }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsx("span", { className: "text-[11px] font-semibold text-textPrimary", children: currentPost.author }), _jsx("span", { className: "text-[9px] text-textMuted", children: currentPost.handle })] }) })] }), _jsx("div", { className: "text-[11px] text-textPrimary leading-relaxed", children: currentPost.text })] }), _jsx("div", { className: "animate-fadeIn", children: _jsxs("div", { className: "flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/10 border border-accent/30", children: [_jsx("div", { className: "flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-lg", children: currentPost.icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[10px] text-textMuted uppercase tracking-wider mb-0.5", children: "Why you're seeing this" }), _jsx("div", { className: "text-xs font-medium text-accent", children: currentPost.reason })] })] }) }), _jsx("div", { className: "flex items-center justify-center gap-4 pt-2", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("svg", { className: "w-3.5 h-3.5 text-green-500", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-[10px] text-textMuted", children: "Export anytime" })] }) })] }) }));
};
// Truth Intelligence Demo - Shows false COVID claim being blocked
const TruthIntelligenceDemo = () => {
    const [stage, setStage] = useState('verifying');
    const [showSourceCheck, setShowSourceCheck] = useState(false);
    const [showClaimCheck, setShowClaimCheck] = useState(false);
    const [showContextCheck, setShowContextCheck] = useState(false);
    useEffect(() => {
        let timeoutIds = [];
        const cycle = () => {
            // Reset
            setStage('verifying');
            setShowSourceCheck(false);
            setShowClaimCheck(false);
            setShowContextCheck(false);
            // Start verifying
            const timeout1 = setTimeout(() => {
                setStage('checking');
                setShowSourceCheck(true);
                const timeout2 = setTimeout(() => {
                    setShowClaimCheck(true);
                    const timeout3 = setTimeout(() => {
                        setShowContextCheck(true);
                        const timeout4 = setTimeout(() => {
                            setStage('blocked');
                            // Reset after showing blocked
                            const timeout5 = setTimeout(() => {
                                cycle();
                            }, 3000);
                            timeoutIds.push(timeout5);
                        }, 800);
                        timeoutIds.push(timeout4);
                    }, 600);
                    timeoutIds.push(timeout3);
                }, 600);
                timeoutIds.push(timeout2);
            }, 1000);
            timeoutIds.push(timeout1);
        };
        cycle();
        return () => {
            timeoutIds.forEach(id => clearTimeout(id));
        };
    }, []);
    return (_jsx("div", { className: "relative w-full flex items-center justify-center py-4", children: _jsx("div", { className: "relative w-full max-w-sm", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: `relative p-3 rounded-xl border backdrop-blur-sm transition-all duration-300 ${stage === 'blocked'
                            ? 'border-red-500/50 bg-red-500/10'
                            : 'border-white/10 bg-white/5'}`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("div", { className: "text-[10px] text-textMuted", children: "New post" }), _jsx("div", { className: "flex items-center gap-1.5", children: stage === 'verifying' || stage === 'checking' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" }), _jsx("span", { className: "text-[10px] text-yellow-500 font-medium", children: "Verifying..." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-1.5 h-1.5 bg-red-500 rounded-full" }), _jsx("span", { className: "text-[10px] text-red-500 font-medium", children: "Blocked" })] })) })] }), _jsx("div", { className: "text-xs text-textPrimary mb-2.5", children: "\"COVID vaccines cause 95% of deaths according to leaked CDC data...\"" }), _jsxs("div", { className: "space-y-1.5 pt-2 border-t border-white/10", children: [_jsxs("div", { className: "flex items-center justify-between text-[10px]", children: [_jsx("span", { className: "text-textMuted", children: "Source verification" }), showSourceCheck ? (stage === 'blocked' ? (_jsxs("div", { className: "flex items-center gap-1 text-red-500", children: [_jsx("svg", { className: "w-2.5 h-2.5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) }), _jsx("span", { children: "Invalid" })] })) : (_jsxs("div", { className: "flex items-center gap-1 text-yellow-500", children: [_jsx("div", { className: "w-2 h-2 border border-yellow-500 border-t-transparent rounded-full animate-spin" }), _jsx("span", { children: "Checking..." })] }))) : null] }), _jsxs("div", { className: "flex items-center justify-between text-[10px]", children: [_jsx("span", { className: "text-textMuted", children: "Claim accuracy" }), showClaimCheck ? (stage === 'blocked' ? (_jsxs("div", { className: "flex items-center gap-1 text-red-500", children: [_jsx("svg", { className: "w-2.5 h-2.5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) }), _jsx("span", { children: "False" })] })) : (_jsxs("div", { className: "flex items-center gap-1 text-yellow-500", children: [_jsx("div", { className: "w-2 h-2 border border-yellow-500 border-t-transparent rounded-full animate-spin" }), _jsx("span", { children: "Checking..." })] }))) : null] }), _jsxs("div", { className: "flex items-center justify-between text-[10px]", children: [_jsx("span", { className: "text-textMuted", children: "Context analysis" }), showContextCheck ? (stage === 'blocked' ? (_jsxs("div", { className: "flex items-center gap-1 text-red-500", children: [_jsx("svg", { className: "w-2.5 h-2.5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) }), _jsx("span", { children: "Misleading" })] })) : (_jsxs("div", { className: "flex items-center gap-1 text-yellow-500", children: [_jsx("div", { className: "w-2 h-2 border border-yellow-500 border-t-transparent rounded-full animate-spin" }), _jsx("span", { children: "Checking..." })] }))) : null] })] })] }), stage === 'blocked' && (_jsx("div", { className: "flex items-center justify-center animate-fadeIn", children: _jsxs("div", { className: "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30", children: [_jsx("svg", { className: "w-3.5 h-3.5 text-red-500", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }), _jsx("span", { className: "text-xs font-semibold text-red-500", children: "Blocked - False Information" })] }) }))] }) }) }));
};
const pillars = [
    {
        id: 'control',
        title: 'Your Experience, Your Control',
        tagline: 'Stop fighting the feed',
        description: 'Other platforms decide what you see. You don\'t. On Kural, talk to your feed in plain English. Type "show more AI posts" or "mute politics" - it just works. Every post shows why it appeared, so you always know what\'s driving your feed. No black boxes. No hidden manipulation.',
        visual: _jsx(TypingAnimation, {}),
        demo: true,
    },
    {
        id: 'audience',
        title: 'Audience Tuning',
        tagline: 'Stop shouting into the void',
        description: 'You post great content. Nobody sees it. On other platforms, algorithms guess who should see your posts - and they guess wrong. On Kural, AI analyzes your content and matches it to users whose profiles align with what you\'re sharing. Your posts reach people who genuinely care, not random followers.',
        visual: _jsx(AudienceTargetingDemo, {}),
        demo: true,
    },
    {
        id: 'monetization',
        title: 'Value over Views',
        tagline: 'Get recognized for what matters',
        description: 'Other platforms reward views. Clickbait wins. On Kural, every post is scored across 5 dimensions: factual rigor, insight, practicality, tone, and effort. Your Kural Score reflects your content\'s real value and impact, not just how many people scrolled past it. Quality creators get recognized. Rage-bait doesn\'t.',
        visual: _jsx(ValueBasedMonetizationDemo, {}),
        demo: true,
    },
    {
        id: 'factcheck',
        title: 'Truth Intelligence',
        tagline: 'Trust what you read',
        description: 'On other platforms, fact-checking takes days or arrives after content goes viral. On Kural, Truth Intelligence verifies every post before you see it. False claims are blocked instantly. Authors who spread misinformation lose credibility and reach. You read verified content, not viral lies.',
        visual: _jsx(TruthIntelligenceDemo, {}),
        demo: true,
    },
    {
        id: 'transparency',
        title: 'Transparent by Design',
        tagline: 'Your data, your rules',
        description: 'Other platforms track you, sell your data, and hide how their algorithms work. On Kural, every recommendation is explained. Your data is yours - export it anytime. We never sell to advertisers. No dark patterns. No addiction optimization. Social media that works for you, not against you.',
        visual: _jsx(TransparencyDemo, {}),
        demo: true,
    },
];
const ValuePropositionSection = ({}) => {
    const [activeTab, setActiveTab] = useState(0);
    return (_jsx("section", { id: "how-it-works", className: "section-container py-20 md:py-32", children: _jsxs("div", { className: "max-w-6xl mx-auto space-y-12", children: [_jsxs("div", { className: "text-center space-y-4", children: [_jsxs("h2", { className: "text-3xl sm:text-4xl md:text-5xl font-bold text-textPrimary", children: ["Why", ' ', _jsx("span", { className: "bg-gradient-to-r from-primary via-accent to-accentSecondary bg-clip-text text-transparent", children: "Kural" }), ' ', "is different"] }), _jsx("p", { className: "text-base md:text-lg text-textMuted max-w-xl mx-auto", children: "Stop fighting the feed. Start getting what you actually want." })] }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "flex flex-wrap justify-center gap-3 mb-8", children: pillars.map((pillar, index) => (_jsx("button", { onClick: () => setActiveTab(index), className: `px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${activeTab === index
                                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 scale-105'
                                    : 'bg-white/5 text-textMuted hover:bg-white/10 hover:text-textPrimary border border-white/10'}`, children: pillar.title }, pillar.id))) }), _jsx("div", { className: "relative min-h-[200px] md:min-h-[240px]", children: pillars.map((pillar, index) => (_jsx("div", { className: `absolute inset-0 transition-all duration-500 ${activeTab === index
                                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                                    : 'opacity-0 translate-y-4 pointer-events-none'}`, children: _jsxs("div", { className: "grid md:grid-cols-2 gap-6 md:gap-8 items-center", children: [_jsx("div", { className: "order-2 md:order-1 flex items-center justify-center", children: _jsx("div", { className: "w-full max-w-sm relative", children: pillar.visual }) }), _jsx("div", { className: "order-1 md:order-2 space-y-5", children: _jsxs("div", { children: [_jsx("div", { className: "inline-block px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-medium mb-3", children: pillar.tagline }), _jsx("h3", { className: "text-2xl md:text-3xl font-bold text-textPrimary mb-3", children: pillar.title }), _jsx("p", { className: "text-base md:text-lg text-textMuted leading-relaxed", children: pillar.description })] }) })] }) }, pillar.id))) })] })] }) }));
};
export default ValuePropositionSection;
