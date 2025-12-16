import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import ContactModal from './ContactModal';
const Footer = () => {
    const year = new Date().getFullYear();
    const [contactModalOpen, setContactModalOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsx("footer", { className: "section-container border-t border-border/40 py-6", children: _jsxs("div", { className: "max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-textMuted", children: [_jsxs("span", { children: ["\u00A9 ", year, " Kural"] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Link, { to: "/terms", className: "hover:text-textPrimary transition-colors", children: "Terms" }), _jsx(Link, { to: "/privacy", className: "hover:text-textPrimary transition-colors", children: "Privacy" }), _jsx("button", { onClick: () => setContactModalOpen(true), className: "hover:text-textPrimary transition-colors", children: "Contact" })] })] }) }), _jsx(ContactModal, { open: contactModalOpen, onClose: () => setContactModalOpen(false) })] }));
};
export default Footer;
