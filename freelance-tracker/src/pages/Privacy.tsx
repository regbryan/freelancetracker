import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'privacy@example.com' // TODO: replace with real contact
const EFFECTIVE_DATE = 'May 15, 2026'

export default function Privacy() {
  return (
    <main className="min-h-screen bg-bg text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <Link to="/" className="text-accent text-[13px] font-semibold hover:underline">
            ← Back to app
          </Link>
          <h1 className="text-[32px] font-bold tracking-[-0.5px] mt-4">Privacy Policy</h1>
          <p className="text-text-muted text-[13px] mt-1">Effective {EFFECTIVE_DATE}</p>
        </header>

        <div className="prose-content flex flex-col gap-6 text-[14px] leading-relaxed">
          <section>
            <p>
              FreelanceFlow (the "Service") is operated by Bough. This Privacy Policy explains what personal
              data the Service collects, why, with whom we share it, how long we keep it, and the rights you
              have over your data. Questions go to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">1. Data we collect</h2>
            <p>The Service collects only what's needed to provide freelance business management features:</p>
            <ul className="list-disc pl-6 mt-3 flex flex-col gap-2">
              <li>
                <strong>Account data</strong>: email address and a hashed password (via Supabase Auth).
                Consent timestamp recorded on signup.
              </li>
              <li>
                <strong>Profile data</strong>: name, business address, phone number, profile photo, business
                logo. You enter these on the Settings page.
              </li>
              <li>
                <strong>Client + contact records</strong>: names, emails, phones, addresses, notes you enter
                about your own clients.
              </li>
              <li>
                <strong>Projects, time entries, tasks, expenses</strong>: productivity data you enter to
                run your business.
              </li>
              <li>
                <strong>Invoices and contracts</strong>: financial records and signed PDF contracts,
                including signer name, email, signature image, and IP address at signing.
              </li>
              <li>
                <strong>Gmail content</strong>: if you connect Gmail, the Service reads the threads matching
                your search queries — full subject, sender/recipient addresses, body, and date. You may
                revoke at any time via Settings.
              </li>
              <li>
                <strong>Calendar events</strong>: if you connect Google or Microsoft Calendar, the Service
                reads event metadata to display alongside your meetings.
              </li>
              <li>
                <strong>AI search queries + email summaries</strong>: when you use the "Ask AI" feature on
                the Emails page, your search query and up to 200 of your synced email summaries are sent
                to a third-party AI service for processing.
              </li>
              <li>
                <strong>Error telemetry</strong>: if a runtime error occurs, anonymized stack-trace and
                browser-version data may be sent to Sentry (if configured).
              </li>
            </ul>
            <p className="mt-3 text-text-muted text-[13px]">
              We do not use analytics, advertising, or behavioral-tracking pixels.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">2. Legal bases (GDPR)</h2>
            <ul className="list-disc pl-6 flex flex-col gap-2">
              <li>
                <strong>Performance of a contract</strong> (Art. 6(1)(b)): account data, profile data, your
                clients/projects/time/expenses/invoices/contracts, Gmail/Calendar integrations you enable.
              </li>
              <li>
                <strong>Consent</strong> (Art. 6(1)(a)): AI email search. You're asked explicitly before
                content is sent off-platform; you can decline and use keyword search instead.
              </li>
              <li>
                <strong>Legitimate interest</strong> (Art. 6(1)(f)): error telemetry — to keep the Service
                working reliably, masked of all message text and media in Session Replay.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">3. Sub-processors</h2>
            <p>We rely on the following providers to deliver the Service. Each has its own privacy policy:</p>
            <ul className="list-disc pl-6 mt-3 flex flex-col gap-2">
              <li><strong>Supabase</strong> — database, authentication, file storage, edge functions. Hosted in the region you select at signup.</li>
              <li><strong>Vercel</strong> — application hosting and CDN.</li>
              <li><strong>Google</strong> — Gmail API + Google Calendar API (only if you connect them).</li>
              <li><strong>Microsoft</strong> — Outlook Calendar (only if you connect it).</li>
              <li><strong>Stripe</strong> — payment link generation for invoices.</li>
              <li><strong>Third-party AI service</strong> — only when you explicitly use "Ask AI" on the Emails page. See AI Email Search below.</li>
              <li><strong>Sentry</strong> — error telemetry (only if configured by the operator).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">4. AI email search</h2>
            <p>
              When you click "Ask AI" on the Emails page and accept the in-app consent prompt, the Service
              sends your search query and up to 200 of your synced email summaries (subject, sender,
              recipient, date, and the first 200 characters of each body) to a third-party AI service via
              an authenticated server-side function. The AI service generates a natural-language answer
              and a list of matching message IDs, which is shown to you.
            </p>
            <p className="mt-2">
              No other user's data is mixed into your request. Your consent is recorded in your browser; you
              can revoke it by clearing your site data or contacting us at the address above.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">5. Use of Google user data</h2>
            <p>
              The Service's use of information received from Google APIs adheres to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-accent underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We use Gmail and Calendar data only to provide
              user-facing features inside the Service, never to train AI models or to serve advertising,
              and never share it with third parties except as needed to provide the feature you requested.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">6. Retention</h2>
            <ul className="list-disc pl-6 flex flex-col gap-2">
              <li>Account, profile, clients, projects, invoices, contracts, time, expenses: retained while your account is active.</li>
              <li>Gmail tokens: retained while Gmail is connected; deleted on disconnect.</li>
              <li>Contract signatures: retained for 7 years after contract signing, for legal-evidence purposes.</li>
              <li>Error telemetry: 30 days, then auto-purged.</li>
              <li>AI search queries: not retained server-side beyond the immediate response.</li>
              <li>After account deletion: all rows owned by you are deleted within 30 days, except where law requires longer retention (e.g. tax records).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">7. Your rights</h2>
            <p>Under GDPR / UK-GDPR / CCPA you have the right to:</p>
            <ul className="list-disc pl-6 mt-3 flex flex-col gap-2">
              <li>Access a copy of your data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and associated data</li>
              <li>Export your data in a machine-readable format</li>
              <li>Withdraw consent for AI email search at any time</li>
              <li>Object to or restrict certain processing</li>
              <li>Lodge a complaint with your supervisory authority</li>
            </ul>
            <p className="mt-3">
              To exercise any of these, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              . We respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">8. Children</h2>
            <p>The Service is not directed to children under 16 and we do not knowingly collect their data.</p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">9. Changes to this policy</h2>
            <p>
              We may update this policy. The "Effective" date at the top reflects the latest version.
              Material changes will be announced in-app and by email.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] font-bold mb-2">10. Contact</h2>
            <p>
              Privacy questions go to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <p className="text-text-muted text-[12px] mt-8 pt-6 border-t border-border">
            This is a starter draft. Replace the contact email and verify the retention periods, sub-processor
            list, and legal bases with counsel before relying on it for production users.
          </p>
        </div>
      </div>
    </main>
  )
}
