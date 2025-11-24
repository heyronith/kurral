import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
const Footer = () => {
    const year = new Date().getFullYear();
    return (_jsx("footer", { className: "section-container border-t border-border/60 py-8 text-sm text-textMuted", children: _jsxs("div", { className: "flex flex-col items-center justify-between gap-4 md:flex-row", children: [_jsxs("span", { children: ["\u00A9 ", year, " Kurral"] }), _jsxs("div", { className: "flex gap-6 text-textLabel", children: [_jsx("span", { children: "Email" }), _jsx("span", { children: "Privacy (coming soon)" }), _jsx("span", { children: "X / Bluesky (coming soon)" })] })] }) }));
};
export default Footer;
