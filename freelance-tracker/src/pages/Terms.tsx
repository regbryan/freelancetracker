import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'support@example.com' // TODO: replace with real contact
const EFFECTIVE_DATE = 'May 15, 2026'

export default function Terms() {
  return (
    <main className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <Link to="/" className="text-accent text-[13px] font-semibold hover:underline">
            ← Back to app
          </Link>
          <h1 className="text-[32px] font-bold tracking-[-0.5px] mt-4">Terms of Service</h1>
          <p className="text-text-muted text-[13px] mt-1">Effective {EFFECTIVE_DATE}</p>
        </header>

        <div className="flex flex-col gap-6 text-[14px] leading-relaxed">
          <section>
            <p>
              These Terms govern your use of FreelanceFlow (the "Service"), operated by Bough.
              By creating an account, you agree to these Terms and our{' '}
              <Link to="/privacy" className="text-accent underline underline-offset-2">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">1. The Service</h2>
            <p>
              FreelanceFlow is a freelance business management application for tracking clients, projects,
              time, expenses, invoices, contracts, meetings, and integrating Gmail / Calendar. The Service
              is provided as-is and may evolve over time.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">2. Your account</h2>
            <ul className="list-disc pl-6 flex flex-col gap-2">
              <li>You're responsible for everything that happens under your account, including securing your password.</li>
              <li>You must be at least 16 years old to use the Service.</li>
              <li>One person per account; account sharing is not permitted.</li>
              <li>You're responsible for the legal compliance of contracts, invoices, and communications you produce inside the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">3. Acceptable use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 mt-3 flex flex-col gap-2">
              <li>Violate any law or third-party rights.</li>
              <li>Send spam, phishing, or fraudulent invoices.</li>
              <li>Reverse-engineer, scrape, or attempt to bypass the Service's security.</li>
              <li>Probe the AI email search feature for prompt-injection or denial-of-service.</li>
              <li>Store data on behalf of third parties without proper authorization (e.g. processing your clients' clients' PII without a written agreement).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">4. Your content</h2>
            <p>
              You retain ownership of the data you put into the Service (clients, invoices, contracts, etc.).
              By using the Service you grant us a limited license to process your data solely to provide the
              Service to you, as described in the{' '}
              <Link to="/privacy" className="text-accent underline underline-offset-2">Privacy Policy</Link>.
            </p>
            <p className="mt-2">
              You're responsible for backing up your data. We strongly recommend exporting periodically.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">5. Integrations (Gmail, Calendar, Stripe)</h2>
            <p>
              When you connect a third-party service (Google Gmail, Google Calendar, Microsoft Outlook,
              Stripe), you also agree to the respective provider's terms. Disconnecting an integration
              revokes the Service's access; pre-existing local copies (e.g. previously synced emails) may
              remain until you delete them.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">6. AI email search</h2>
            <p>
              The "Ask AI" feature on the Emails page processes your data via a third-party AI service.
              Output is generated automatically and may contain errors. Don't rely on AI output for legal,
              financial, or medical decisions without independent verification.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">7. Termination</h2>
            <p>
              You can delete your account at any time from Settings (or by emailing{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              ). We may suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">8. Disclaimers + liability</h2>
            <p>
              The Service is provided "as is" without warranty of any kind. To the maximum extent permitted
              by law, we're not liable for indirect, incidental, or consequential damages, and our total
              liability is capped at the fees you paid in the 12 months preceding the claim (or $100 if the
              Service was free).
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">9. Changes</h2>
            <p>
              We may update these Terms. Material changes will be announced in-app and by email at least
              30 days before they take effect. Continued use after the effective date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">10. Governing law</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction in which the operator is established,
              without regard to conflict-of-laws principles. <em>[TODO: confirm jurisdiction with counsel.]</em>
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">11. Contact</h2>
            <p>
              Questions or notices go to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <p className="text-text-muted text-[12px] mt-8 pt-6 border-t border-border">
            This is a starter draft. Replace the contact email and confirm jurisdiction + liability clauses
            with counsel before relying on it for production users.
          </p>
        </div>
      </div>
    </main>
  )
}
