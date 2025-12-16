import { Link } from 'react-router-dom';
import { useThemeStore } from '../webapp/store/useThemeStore';

const TermsOfService = () => {
  const { theme } = useThemeStore();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-black' : 'bg-background'} text-textPrimary`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 border-b ${theme === 'dark' ? 'border-white/10 bg-black/95' : 'border-border/60 bg-background/95'} py-4 backdrop-blur-lg shadow-elevated`}>
        <div className="section-container flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-textPrimary tracking-tight hover:text-accent transition-colors duration-200">
            Kural
            <img src="/quotation-marks.png" alt="" className="h-6 w-auto" loading="eager" />
          </Link>
          <Link
            to="/"
            className="text-sm text-textMuted hover:text-textPrimary transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="section-container py-12">
        <div className="max-w-4xl mx-auto">
          <div className={`prose prose-lg ${theme === 'dark' ? 'prose-invert' : ''} max-w-none`}>
            <h1 className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
              Terms of Service
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-8`}>
              Last Updated: December 13, 2025
            </p>

            <div className={`space-y-8 ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'}`}>
              <section>
                <p className="leading-relaxed">
                  Welcome to Kural. These Terms of Service ("<strong>Terms</strong>") govern your access to and use of the Kural platform, including our website, mobile applications, and services (collectively, "<strong>Kural</strong>" or the "<strong>Service</strong>").
                </p>
                <p className="leading-relaxed mt-4">
                  <strong>Note:</strong> Kural is currently operated as a beta service. The Service is provided by the operator(s) of Kural ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>"). These Terms may be updated when Kural is formally incorporated as a legal entity.
                </p>
                <p className="leading-relaxed mt-4">
                  By accessing or using Kural, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Service.
                </p>
                <p className="leading-relaxed mt-4">
                  Please read these Terms carefully, as they contain important information about your legal rights, remedies, and obligations. These Terms include an agreement to resolve disputes through arbitration (instead of suing in court) and to waive jury trials and class actions in most cases.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  1. Eligibility and Age Requirements
                </h2>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  1.1 Minimum Age
                </h3>
                <p className="leading-relaxed">
                  To use Kural, you must be at least 13 years old and meet the minimum age required by your local laws to enter into a binding agreement. If you are under 18, you represent that you have obtained parental or guardian consent to use the Service.
                </p>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  1.2 Age Verification
                </h3>
                <p className="leading-relaxed">
                  In some jurisdictions, we may be required to restrict access to certain features or content unless you complete an age assurance process and demonstrate that you are an adult. When age assurance is required, we use methods that comply with applicable laws.
                </p>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  1.3 Capacity to Contract
                </h3>
                <p className="leading-relaxed">
                  You represent and warrant that you have the legal capacity and authority to enter into these Terms and to use the Service in accordance with all applicable laws and regulations.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  2. Account Registration and Responsibilities
                </h2>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  2.1 Account Creation
                </h3>
                <p className="leading-relaxed">
                  To use Kural, you must create an account ("<strong>Account</strong>"). You agree to provide accurate, complete, and current information during registration and to update such information to keep it accurate, complete, and current.
                </p>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  2.2 Account Security
                </h3>
                <p className="leading-relaxed">
                  You are solely responsible for:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your Account, whether authorized by you or not</li>
                  <li>Immediately notifying us of any unauthorized use of your Account or any other breach of security</li>
                </ul>
                <p className="leading-relaxed mt-4">
                  We will presume that any activity made through your valid login credentials was authorized by you. We are not required to verify the source of access.
                </p>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  2.3 Account Restrictions
                </h3>
                <p className="leading-relaxed">
                  You may not:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Share your Account with others or use anyone else's account</li>
                  <li>Create multiple accounts to evade enforcement actions or restrictions</li>
                  <li>Use an account name that impersonates another person or entity</li>
                  <li>Use an account name that violates any third party's rights</li>
                  <li>Use an account name that is offensive, vulgar, or obscene</li>
                </ul>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  3. Acceptable Use and Content Policies
                </h2>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  3.1 Your Responsibility for Content
                </h3>
                <p className="leading-relaxed">
                  You are solely responsible for all content you post, upload, share, transmit, or otherwise make available through Kural ("<strong>Your Content</strong>"). You represent and warrant that Your Content:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Complies with all applicable laws and regulations</li>
                  <li>Does not violate any third party's rights, including intellectual property, privacy, or publicity rights</li>
                  <li>Is accurate and truthful to the best of your knowledge</li>
                  <li>Does not contain false or misleading information</li>
                </ul>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  3.2 Prohibited Content
                </h3>
                <p className="leading-relaxed">
                  You agree not to post, upload, share, transmit, or otherwise make available any content that:
                </p>
                <p className="font-semibold mt-4">Illegal Activity:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Violates any applicable law, regulation, or court order</li>
                  <li>Promotes or facilitates illegal activities, including but not limited to fraud, money laundering, or terrorism</li>
                  <li>Contains or promotes controlled substances, illegal drugs, or prescription medications without authorization</li>
                  <li>Facilitates the sale of weapons, firearms, or other dangerous materials</li>
                </ul>
                <p className="font-semibold mt-4">Harmful Content:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Threatens, harasses, bullies, or intimidates others</li>
                  <li>Contains hate speech or discriminates against individuals or groups based on protected characteristics</li>
                  <li>Promotes or glorifies violence, self-harm, or suicide</li>
                  <li>Contains graphic violence designed to shock, disturb, or intimidate</li>
                  <li>Exploits or harms minors in any way</li>
                  <li>Contains non-consensual intimate images or content</li>
                </ul>
                <p className="font-semibold mt-4">Deceptive Content:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Impersonates another person, entity, or organization</li>
                  <li>Contains false or misleading information intended to deceive</li>
                  <li>Constitutes spam, unsolicited advertising, or chain letters</li>
                  <li>Artificially manipulates engagement metrics or platform features</li>
                </ul>
                <p className="font-semibold mt-4">Malicious Content:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Contains viruses, malware, trojan horses, or other harmful code</li>
                  <li>Attempts to compromise, exploit, or disrupt Kural's systems or security</li>
                  <li>Violates intellectual property rights, including copyright, trademark, or patent rights</li>
                </ul>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  4. Truth Intelligence and Fact-Checking
                </h2>
                <p className="leading-relaxed">
                  Kural uses Truth Intelligence, an automated system that verifies factual claims in posts using AI analysis and, when necessary, human intervention. Every post is analyzed for verifiable factual claims before it goes live.
                </p>
                <p className="leading-relaxed mt-4">
                  Based on fact-check results, your content may be assigned one of the following statuses: <strong>Clean</strong> (all claims verified), <strong>Needs Review</strong> (high-risk claims requiring human review), or <strong>Blocked</strong> (false claims verified with high confidence).
                </p>
                <p className="leading-relaxed mt-4">
                  While we use our best efforts to verify claims, we do not guarantee that all fact-check results are 100% accurate. Fact-checking is an evolving process, and new evidence may emerge over time.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  5. Kural Score System
                </h2>
                <p className="leading-relaxed">
                  The Kural Score is a proprietary scoring system (0-100) that measures your content's quality, trustworthiness, and value across five dimensions: factual rigor, insight, practical value, tone and discourse quality, and effort/depth.
                </p>
                <p className="leading-relaxed mt-4">
                  Your Kural Score affects content visibility, recognition, and eligibility for monetization (requires minimum score of 77). Sharing false information or violating policies will result in score penalties.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  6. Content Ownership and License
                </h2>
                <p className="leading-relaxed">
                  You retain all ownership rights to Your Content. By posting content on Kural, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, and distribute Your Content to operate, provide, and improve Kural.
                </p>
                <p className="leading-relaxed mt-4">
                  You have the right to export Your Content at any time. To request a copy of your data, please email us at <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a> with "Data Export Request" in the subject line. We will provide your data in a standard, machine-readable format within 30 days.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  7. Data Ownership and Privacy
                </h2>
                <p className="leading-relaxed">
                  You own your data completely. You can request a copy of all your data at any time by emailing <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a> with "Data Export Request" in the subject line. We provide transparent privacy controls and we never sell your data to third parties. Your algorithm preferences, audience targeting settings, and all content are yours to control and export at any time.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  8. Monetization and Value-Based Recognition
                </h2>
                <p className="leading-relaxed">
                  Kural uses a value-based recognition system rather than view-based metrics. To be eligible for monetization (when available), you must meet: minimum Kural Score of 77, account age of at least 30 days, and no active violations.
                </p>
                <p className="leading-relaxed mt-4">
                  All users who join during our beta period will receive lifetime access to premium features, including monetization eligibility (when available), at no cost.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  9. Content Moderation and Enforcement
                </h2>
                <p className="leading-relaxed">
                  We use automated tools and human moderation to detect and act on prohibited content. If you violate these Terms, we may take enforcement action including removing content, reducing your Kural Score, limiting account features, or terminating your account.
                </p>
                <p className="leading-relaxed mt-4">
                  If your account is suspended, restricted, or terminated, you may appeal the decision by contacting us at <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a> within 30 days.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  10. Termination
                </h2>
                <p className="leading-relaxed">
                  You may terminate your Account at any time. We may suspend, restrict, or terminate your Account if you violate these Terms, we are legally required to do so, or we believe your continued access poses a risk to Kural, other users, or third parties.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  11. Intellectual Property
                </h2>
                <p className="leading-relaxed">
                  The Service and its original content are the exclusive property of Kural and its licensors. "Kural" and related marks are trademarks of Kural.
                </p>
                <p className="leading-relaxed mt-4">
                  If you believe your copyright has been infringed, please contact us at <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a>.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  12. Warranty Disclaimer
                </h2>
                <p className="leading-relaxed">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. We do not warrant that the Service will be uninterrupted, timely, secure, or error-free, or that all fact-check results are 100% accurate.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  13. Limitation of Liability
                </h2>
                <p className="leading-relaxed">
                  TO THE FULLEST EXTENT PERMITTED BY LAW, KURAL'S TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS IS LIMITED TO ONE HUNDRED U.S. DOLLARS (US$100) OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, WHICHEVER IS GREATER.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  14. Dispute Resolution and Arbitration
                </h2>
                <p className="leading-relaxed">
                  <strong>IMPORTANT:</strong> These Terms require you to arbitrate disputes and waive your right to a jury trial and class actions. Before initiating any legal proceeding, you agree to contact us first at <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a> and allow us at least 60 days to resolve the dispute informally.
                </p>
                <p className="leading-relaxed mt-4">
                  Subject to exceptions, any dispute relating to these Terms will be resolved through final and binding arbitration by the American Arbitration Association (AAA), seated in Oklahoma, United States.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  15. Governing Law
                </h2>
                <p className="leading-relaxed">
                  These Terms are governed by the laws of Oklahoma, United States, without regard to its conflict of law principles. If you are located in the European Union or European Economic Area, you may have additional rights under applicable EU law.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  16. Changes to These Terms
                </h2>
                <p className="leading-relaxed">
                  We reserve the right to modify these Terms at any time. Material changes will be effective 30 days after notice. Your continued use of the Service after changes become effective constitutes acceptance of the revised Terms.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  17. Contact Information
                </h2>
                <p className="leading-relaxed">
                  If you have questions about these Terms, please contact us at:
                </p>
                <p className="leading-relaxed mt-4">
                  <strong>Email:</strong> <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a><br />
                  <strong>Website:</strong> <a href="https://mykural.app" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">https://mykural.app</a>
                </p>
                <p className="leading-relaxed mt-4">
                  <strong>Note:</strong> Kural is currently in beta and operated by Ronith Sharmila. When Kural is formally incorporated, these contact details will be updated accordingly.
                </p>
              </section>

              <section className="mt-12 pt-8 border-t border-border/60">
                <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
                  <strong>By using Kural, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</strong>
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
