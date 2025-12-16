import { Link } from 'react-router-dom';
import { useThemeStore } from '../webapp/store/useThemeStore';

const PrivacyPolicy = () => {
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
              Privacy Policy
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-8`}>
              Last Updated: December 13, 2025
            </p>

            <div className={`space-y-8 ${theme === 'dark' ? 'text-white/90' : 'text-textPrimary'}`}>
              <section>
                <p className="leading-relaxed">
                  At Kural, we believe that your data belongs to you. This Privacy Policy explains how we collect, use, share, and protect your personal information when you use Kural ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>", or the "<strong>Service</strong>").
                </p>
                <p className="leading-relaxed mt-4">
                  <strong>Note:</strong> Kural is currently operated as a beta service. The Service is provided by the operator(s) of Kural. This Privacy Policy may be updated when Kural is formally incorporated as a legal entity.
                </p>
                <p className="leading-relaxed mt-4">
                  By using Kural, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, please do not use the Service.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  1. Information We Collect
                </h2>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  1.1 Information You Provide to Us
                </h3>
                <p className="font-semibold mt-4">Account Information:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Name and display name</li>
                  <li>Email address</li>
                  <li>Username/handle</li>
                  <li>Profile picture and cover photo</li>
                  <li>Bio, location, and website URL</li>
                  <li>Interests and topics you follow</li>
                </ul>
                <p className="font-semibold mt-4">Content You Create:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Posts (chirps) and comments</li>
                  <li>Bookmarks</li>
                  <li>Profile information and preferences</li>
                </ul>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  1.2 Information Automatically Collected
                </h3>
                <p className="font-semibold mt-4">Usage Data:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>How you interact with the Service (views, likes, comments, shares)</li>
                  <li>Content you engage with</li>
                  <li>Time and date of your activities</li>
                  <li>Device information (browser type, operating system)</li>
                  <li>IP address and general location information</li>
                </ul>
                <p className="font-semibold mt-4">Algorithm and Personalization Data:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Feed interaction patterns</li>
                  <li>Content preferences inferred from your behavior</li>
                  <li>Kural Score and value statistics</li>
                  <li>Profile embeddings and semantic summaries (for content recommendations)</li>
                </ul>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  2. How We Use Your Information
                </h2>
                <p className="leading-relaxed">
                  We use your information only for the following purposes:
                </p>
                <ul className="list-disc pl-6 mt-4 space-y-2">
                  <li><strong>Service Operation:</strong> To create and maintain your account, provide the Service, authenticate your identity, and process your requests</li>
                  <li><strong>Personalization:</strong> To personalize your feed, customize your experience, generate your Kural Score, and provide relevant content</li>
                  <li><strong>Content Moderation and Safety:</strong> To verify factual claims, detect and prevent spam and abuse, enforce our Terms of Service, and protect user safety</li>
                  <li><strong>Communication:</strong> To send service-related notifications, respond to inquiries, and notify you of important changes</li>
                  <li><strong>Legal Compliance:</strong> To comply with applicable laws, respond to legal requests, and protect our rights</li>
                  <li><strong>Service Improvement:</strong> To analyze usage patterns, develop new features, and conduct research using aggregated, anonymized data</li>
                </ul>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  3. How We Share Your Information
                </h2>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  3.1 Public Information
                </h3>
                <p className="leading-relaxed">
                  The following information is <strong>publicly visible</strong> on Kural:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Your username/handle, display name, profile picture and cover photo</li>
                  <li>Your bio, location, and website (if provided)</li>
                  <li>Your posts and comments</li>
                  <li>Your follower and following lists</li>
                  <li>Your public engagement (likes, comments on public posts)</li>
                </ul>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  3.2 We Do NOT Sell Your Data
                </h3>
                <p className="leading-relaxed">
                  <strong>We never sell your personal data to third parties.</strong> This is a core principle of Kural. We do not:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Sell your personal information to advertisers</li>
                  <li>Sell your data to data brokers</li>
                  <li>Monetize your personal information through data sales</li>
                  <li>Share your personal information for marketing purposes without your explicit consent</li>
                </ul>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  3.3 Limited Sharing
                </h3>
                <p className="leading-relaxed">
                  We may share your information only in limited circumstances:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Service Providers:</strong> Third-party providers (cloud hosting, authentication) who are contractually obligated to protect your information</li>
                  <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect rights and safety</li>
                  <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets (with notice)</li>
                  <li><strong>With Your Consent:</strong> When you explicitly consent for specific purposes</li>
                </ul>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  4. Data Ownership and Control
                </h2>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  4.1 You Own Your Data
                </h3>
                <p className="leading-relaxed">
                  <strong>You own all of your data on Kural.</strong> This includes your profile information, posts, comments, algorithm preferences, audience targeting settings, engagement data, and Kural Score.
                </p>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  4.2 Data Export
                </h3>
                <p className="leading-relaxed">
                  You have the right to export your data at any time. To request a copy of your data, please email us at <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a> with "Data Export Request" in the subject line. We will provide your data in a standard, machine-readable format (typically JSON) within 30 days of your request.
                </p>
                <p className="leading-relaxed mt-4">
                  Your exported data will include your profile information, all your posts and comments, bookmarks, following list, Kural Score, value statistics, notifications, and links to images you've uploaded. We will verify your identity before providing the export.
                </p>
                <h3 className={`text-xl font-semibold mt-6 mb-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  4.3 Data Deletion
                </h3>
                <p className="leading-relaxed">
                  You can delete your account and data at any time. When you delete your account, we will delete your personal information from active systems within 30 days. Some information may remain in backup systems for up to 90 days, and content shared publicly may remain visible if reposted by others.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  5. Data Security
                </h2>
                <p className="leading-relaxed">
                  We implement industry-standard security measures including encryption in transit and at rest, secure authentication systems, regular security assessments, and access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  6. Your Privacy Rights
                </h2>
                <p className="leading-relaxed">
                  Depending on your location, you may have the following rights:
                </p>
                <ul className="list-disc pl-6 mt-4 space-y-2">
                  <li><strong>Right to Access:</strong> Request a copy of the personal information we hold about you</li>
                  <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
                  <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete information</li>
                  <li><strong>Right to Erasure:</strong> Request deletion of your personal information (subject to legal requirements)</li>
                  <li><strong>Right to Object:</strong> Object to certain processing of your information</li>
                  <li><strong>Right to Restriction:</strong> Request restriction of processing in certain circumstances</li>
                  <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for processing based on consent (where applicable)</li>
                </ul>
                <p className="leading-relaxed mt-4">
                  To exercise any of these rights, including requesting access to or export of your data, please contact us at <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a>. We will respond within 30 days (or as required by applicable law).
                </p>
                <p className="leading-relaxed mt-2">
                  <strong>For Data Export Requests:</strong> Please email <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a> with "Data Export Request" in the subject line. Include your username or email address so we can verify your identity.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  7. Children's Privacy
                </h2>
                <p className="leading-relaxed">
                  Kural is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn that we have collected information from a child under 13, we will delete that information immediately and take steps to prevent future collection.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  8. Cookies and Tracking Technologies
                </h2>
                <p className="leading-relaxed">
                  We use essential cookies that are necessary for the Service to function (authentication, security, session management). We may use analytics tools to understand usage patterns, but we do not use third-party advertising cookies or tracking pixels. We do not allow third-party advertisers to place cookies on our Service.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  9. Changes to This Privacy Policy
                </h2>
                <p className="leading-relaxed">
                  We may update this Privacy Policy from time to time. Material changes will be effective 30 days after notice. We will notify you by posting the revised Privacy Policy on our website, sending an email notification, or displaying a notice in the Service. Your continued use after changes become effective constitutes acceptance of the revised Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className={`text-2xl font-bold mt-8 mb-4 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                  10. Contact Us
                </h2>
                <p className="leading-relaxed">
                  If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <p className="leading-relaxed mt-4">
                  <strong>Email:</strong> <a href="mailto:support@kurral.app" className="text-accent hover:underline">support@kurral.app</a><br />
                  <strong>Website:</strong> <a href="https://mykural.app" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">https://mykural.app</a>
                </p>
                <p className="leading-relaxed mt-4">
                  For privacy-related requests, data export requests, or to exercise your privacy rights, please email us with the appropriate subject line (e.g., "Privacy Request", "Data Export Request").
                </p>
                <p className="leading-relaxed mt-4">
                  <strong>Note:</strong> Kural is currently in beta and operated by Ronith Sharmila. When Kural is formally incorporated, these contact details will be updated accordingly.
                </p>
              </section>

              <section className="mt-12 pt-8 border-t border-border/60">
                <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
                  <strong>By using Kural, you acknowledge that you have read, understood, and agree to this Privacy Policy.</strong>
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-2`}>
                  This Privacy Policy should be read together with our <Link to="/terms" className="text-accent hover:underline">Terms of Service</Link>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
