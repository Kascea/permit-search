import type {
  CityContactsResponse,
  OfficeContact,
  OfficeType,
} from '#/lib/contacts/types'

const OFFICE_LABELS: Record<OfficeType, string> = {
  building: 'Building and inspections',
  zoning: 'Planning and zoning',
  engineering: 'Engineering',
  general: 'Permits',
}

// Renders nothing until the city's contacts arrive, or when it has none.
export function CityContactCard({
  contacts,
}: {
  contacts?: CityContactsResponse
}) {
  if (
    !contacts ||
    !(contacts.primaryOffice || contacts.portalUrl || contacts.permitsUrl)
  ) {
    return null
  }
  const office = contacts.primaryOffice

  return (
    <section
      aria-label="City permit office"
      className="border border-ink px-5 py-5"
    >
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        City permit office
      </p>
      {office && (
        <>
          <h3 className="mt-1 text-lg leading-6 font-medium text-ink">
            {office.name ?? OFFICE_LABELS[office.officeType]}
          </h3>
          <OfficeDetails office={office} />
        </>
      )}

      {contacts.portalUrl && (
        <div className="mt-5 border-t border-ink/20 pt-4">
          <p className="text-sm font-medium text-ink">Apply online</p>
          <p className="mt-1 text-sm leading-5 text-ink/70">
            The city takes permit applications through its online permit portal.
          </p>
          <a
            className="mt-2 inline-block text-sm font-medium text-blueprint underline-offset-2 hover:underline"
            href={contacts.portalUrl}
            rel="noreferrer"
            target="_blank"
          >
            Go to {hostname(contacts.portalUrl)} ↗
          </a>
        </div>
      )}

      {contacts.permitsUrl && (
        <a
          className="mt-3 block text-sm font-medium text-blueprint underline-offset-2 hover:underline"
          href={contacts.permitsUrl}
          rel="noreferrer"
          target="_blank"
        >
          City permits page ↗
        </a>
      )}

      {contacts.otherOffices.length > 0 && (
        <div className="mt-5 border-t border-ink/20 pt-4">
          <p className="text-xs font-medium tracking-[0.08em] text-ink/70 uppercase">
            Other offices
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {contacts.otherOffices.map((other) => (
              <li key={other.officeType}>
                <span className="font-medium">
                  {other.name ?? OFFICE_LABELS[other.officeType]}
                </span>
                {other.phone && (
                  <>
                    {' · '}
                    <a
                      className="hover:text-blueprint"
                      href={telHref(other.phone)}
                    >
                      {other.phone}
                    </a>
                  </>
                )}
                {other.email && (
                  <>
                    {' · '}
                    <a
                      className="hover:text-blueprint"
                      href={`mailto:${other.email}`}
                    >
                      {other.email}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(office?.sourceUrl || contacts.checkedAt) && (
        <p className="mt-4 text-xs text-ink/70">
          {office?.sourceUrl && (
            <a
              className="underline hover:text-blueprint"
              href={office.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Source
            </a>
          )}
          {office?.sourceUrl && contacts.checkedAt && ' · '}
          {contacts.checkedAt &&
            `Checked ${new Date(contacts.checkedAt).toLocaleDateString()}`}
        </p>
      )}
    </section>
  )
}

function OfficeDetails({ office }: { office: OfficeContact }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = []
  if (office.phone) {
    rows.push({
      label: 'Phone',
      value: (
        <a className="hover:text-blueprint" href={telHref(office.phone)}>
          {office.phone}
        </a>
      ),
    })
  }
  if (office.email) {
    rows.push({
      label: 'Email',
      value: (
        <a
          className="break-all hover:text-blueprint"
          href={`mailto:${office.email}`}
        >
          {office.email}
        </a>
      ),
    })
  }
  if (office.streetAddress) {
    rows.push({ label: 'Address', value: office.streetAddress })
  }
  if (office.hours) {
    rows.push({ label: 'Hours', value: office.hours })
  }

  return (
    <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(({ label, value }) => (
        <div className="contents" key={label}>
          <dt className="text-ink/70">{label}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'the permit portal'
  }
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
