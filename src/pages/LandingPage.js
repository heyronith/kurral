import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ValuePropositionSection from '../components/ValuePropositionSection';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';
import DemoModal from '../components/DemoModal';
import BetaSignupModal from '../components/BetaSignupModal';
const LandingPage = () => {
    const [demoOpen, setDemoOpen] = useState(false);
    const [betaSignupOpen, setBetaSignupOpen] = useState(false);
    return (_jsxs("div", { className: "min-h-screen bg-background text-textPrimary", children: [_jsx(Navbar, { onGetStartedClick: () => setBetaSignupOpen(true) }), _jsxs("main", { className: "flex flex-col", children: [_jsx(Hero, { onGetStartedClick: () => setBetaSignupOpen(true) }), _jsx(ValuePropositionSection, {}), _jsx(FAQ, {})] }), _jsx(Footer, {}), _jsx(DemoModal, { open: demoOpen, onClose: () => setDemoOpen(false) }), _jsx(BetaSignupModal, { open: betaSignupOpen, onClose: () => setBetaSignupOpen(false) })] }));
};
export default LandingPage;
