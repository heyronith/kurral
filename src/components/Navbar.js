import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
const links = [
    { href: '#how-it-works', label: 'How it works' },
    { href: '#faq', label: 'FAQ' },
];
const Navbar = () => {
    return (_jsx("header", { className: "sticky top-0 z-40 border-b border-border/60 bg-background/95 py-5 backdrop-blur-lg shadow-elevated", children: _jsxs("div", { className: "section-container flex items-center justify-between", children: [_jsxs(Link, { to: "/lp", className: "flex items-center gap-2 text-xl font-bold text-textPrimary tracking-tight hover:text-accent transition-colors duration-200", children: ["Kurral", _jsx("img", { src: "/quotation-marks.png", alt: "", className: "h-6 w-auto" })] }), _jsxs("div", { className: "hidden md:flex items-center gap-4", children: [_jsx("nav", { className: "flex items-center gap-6 text-sm font-medium text-textMuted", children: links.map((link) => (_jsx("a", { href: link.href, className: "transition-all duration-200 hover:text-textPrimary hover:translate-y-[-1px]", children: link.label }, link.href))) }), _jsx(Link, { to: "/app", className: "rounded-lg bg-gradient-to-r from-accent to-accentLight px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-button hover:shadow-buttonHover active:scale-95", children: "Try Kurral" })] })] }) }));
};
export default Navbar;
