import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFeedStore } from '../store/useFeedStore';
import ChirpCard from './ChirpCard';
const LatestFeed = () => {
    const getLatestFeed = useFeedStore((state) => state.getLatestFeed);
    const chirps = getLatestFeed();
    if (chirps.length === 0) {
        return (_jsxs("div", { className: "p-8 text-center text-textMuted", children: [_jsx("p", { children: "No chirps yet. Follow some users to see their posts here." }), _jsx("p", { className: "text-sm mt-2", children: "Because: Latest \u2013 pure chronological" })] }));
    }
    return (_jsxs("div", { children: [_jsx("div", { className: "px-4 py-2 text-xs text-textMuted border-b border-border", children: "Because: Latest \u2013 pure chronological" }), chirps.map((chirp) => (_jsx(ChirpCard, { chirp: chirp }, chirp.id)))] }));
};
export default LatestFeed;
