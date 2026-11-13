import { Link, createFileRoute } from '@tanstack/react-router'

import {
  ContactLink,
  LegalPage,
  LegalSection,
  legalLinkClass,
} from '#/components/LegalPage'
import { SITE_URL } from '#/lib/site'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms of Service | Permit Search' },
      {
        name: 'description',
        content: 'The terms for using Permit Search and its browser extension.',
      },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}terms` }],
  }),
  component: Terms,
})

function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p className="text-lg leading-7 text-ink">
        These terms cover your use of Permit Search, at permitsearch.app and
        through its browser extension (the “service”). By using the service,
        you agree to them. If you don’t agree, don’t use it.
      </p>

      <LegalSection title="Not official advice">
        <p>
          Permit Search helps you find permit information from cities and other
          public sources, and helps you fill in forms. We aren’t a government
          agency, and nothing in the service is legal, engineering or
          professional advice. Results, form checks and autofill can be wrong
          or out of date. Always confirm requirements with your local
          permitting office, and review every form yourself before you submit
          it. You’re responsible for what you submit.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          Some features need an account. Give accurate information, keep your
          password secure, and tell us if you think someone else has used your
          account. You’re responsible for what happens under your account. You
          must be at least 13 to use the service.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don’t:</p>
        <ul>
          <li>break the law or anyone else’s rights using the service;</li>
          <li>
            scrape, overload or try to get around rate limits or security
            measures;
          </li>
          <li>
            try to access other people’s accounts or data, or reverse engineer
            the service;
          </li>
          <li>upload malware or content you don’t have the right to use.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You keep ownership of what you put into the service, such as
          projects, forms and drafts. You give us permission to store, process
          and display it only as needed to run the service for you. How we
          handle personal information is described in our{' '}
          <Link to="/privacy" className={legalLinkClass}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Our service">
        <p>
          The service, its design and its software belong to us. Links to
          third-party sites, such as city permit portals, are provided for
          convenience; we don’t control those sites and aren’t responsible for
          them. We may change, suspend or stop any part of the service at any
          time.
        </p>
      </LegalSection>

      <LegalSection title="Ending your use">
        <p>
          You can stop using the service and delete your account at any time.
          We may suspend or close accounts that break these terms.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          The service is provided “as is” and “as available”, without
          warranties of any kind, including warranties of accuracy, fitness for
          a particular purpose or non-infringement.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent the law allows, we aren’t liable for indirect,
          incidental, special or consequential damages, or for lost profits,
          data, fines, fees or project delays, arising from your use of the
          service. Our total liability for any claim is limited to the greater
          of the amount you paid us in the past 12 months or $50.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We may update these terms. If we do, we’ll change the date at the top
          of this page, and tell you in the app if the changes are significant.
          Using the service after a change means you accept the new terms.
          Questions? Email <ContactLink />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
