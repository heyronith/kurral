import { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ValuePropositionSection from '../components/ValuePropositionSection';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';
import DemoModal from '../components/DemoModal';

const LandingPage = () => {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-textPrimary">
      <Navbar />
      <main className="flex flex-col">
        <Hero />
        <ValuePropositionSection onShowDemo={() => setDemoOpen(true)} />
        <FAQ />
      </main>
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
};

export default LandingPage;

