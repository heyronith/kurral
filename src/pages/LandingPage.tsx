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

  return (
    <div className="min-h-screen bg-background text-textPrimary">
      <Navbar onGetStartedClick={() => setBetaSignupOpen(true)} />
      <main className="flex flex-col">
        <Hero onGetStartedClick={() => setBetaSignupOpen(true)} />
        <ValuePropositionSection />
        <FAQ />
      </main>
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <BetaSignupModal open={betaSignupOpen} onClose={() => setBetaSignupOpen(false)} />
    </div>
  );
};

export default LandingPage;

