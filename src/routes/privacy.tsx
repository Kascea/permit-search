import { createFileRoute } from '@tanstack/react-router'

import {
  ContactLink,
  LegalPage,
  LegalSection,
  legalLinkClass,
} from '#/components/LegalPage'
import { SITE_URL } from '#/lib/site'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Policy | Permit Search' },
      {
        name: 'description',
        content:
          'What Permit Search collects, how it is used and shared, and the choices you have.',
      },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}privacy` }],
  }),
  component: Privacy,
})

function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-lg leading-7 text-ink">
        This policy explains what Permit Search (“we”, “us”) collects when you
        use permitsearch.app and the Permit Search browser extension, how we
        use it, and the choices you have.
      </p>

      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong className="font-medium text-ink">Account details.</strong>{' '}
            Your name, email address and a hashed password when you create an
            account. If you sign in with Google, we receive your name, email
            address and profile picture from Google. We don’t receive your
            Google password or access to your other Google data.
          </li>
          <li>
            <strong className="font-medium text-ink">What you put in.</strong>{' '}
            Searches, projects, saved and tracked permits, and the permit forms
            and drafts you fill in, including any details you type into them.
          </li>
          <li>
            <strong className="font-medium text-ink">Technical data.</strong>{' '}
            Your IP address, browser type and request logs, which we use to keep
            the service running, prevent abuse and limit sign-in attempts.
          </li>
          <li>
            <strong className="font-medium text-ink">On your device.</strong>{' '}
            Drafts you make without an account, and preferences like dark mode,
            are kept in your browser’s local storage. Sign-in uses cookies that
            are needed for the site to work. We don’t use advertising cookies.
          </li>
          <li>
            <strong className="font-medium text-ink">The extension.</strong>{' '}
            When you ask it to fill a form, the extension reads that page’s form
            fields so it can match them to your project. It only runs on pages
            you open it on.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>To provide the service: run searches, save your work, fill and check forms.</li>
          <li>To keep accounts secure and prevent fraud and abuse.</li>
          <li>To fix problems and improve Permit Search.</li>
          <li>To reply when you contact us.</li>
        </ul>
        <p>We don’t sell your personal information or use it for advertising.</p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          We share information only with service providers that help us run
          Permit Search, and only what they need to do that work: hosting and
          content delivery, our database host, web search providers that look
          up permit pages for your searches, and AI providers that help read and
          fill forms. They may not use it for their own purposes.
        </p>
        <p>
          We may also disclose information if the law requires it, to protect
          the rights and safety of our users or others, or as part of a merger
          or sale of the business.
        </p>
        <p>
          Searches can have a public link that anyone can open. Those pages show
          the search and its results, not who made it.
        </p>
      </LegalSection>

      <LegalSection title="Google user data">
        <p>
          When you sign in with Google, we use your name, email address and
          profile picture only to create and identify your account. Permit
          Search’s use of information received from Google APIs adheres to the{' '}
          <a
            className={legalLinkClass}
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We don’t transfer this data
          to others except as needed to provide the service, and we don’t use
          it for advertising or to train AI models.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your account and what you save in it until you delete it.
          You can delete your account in Settings, which deletes your saved
          work with it. Backups and logs may hold copies for a short time
          afterward.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can view and change what you’ve saved in your account, and delete
          your account at any time. Depending on where you live, you may have
          the right to request a copy of your information, correct it or have it
          deleted. Email us at <ContactLink /> and we’ll help.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use encryption in transit, hashed passwords and limited access to
          protect your information. No service is perfectly secure, so we can’t
          guarantee it.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Permit Search isn’t meant for children under 13, and we don’t
          knowingly collect their information.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If we change this policy, we’ll update the date at the top of this
          page, and tell you in the app if the changes are significant.
          Questions? Email <ContactLink />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
