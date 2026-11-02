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

interface CityContactCardProps {
  contacts?: CityContactsResponse
  isLoading: boolean
}

// Whether the card has anything to show; the page lays out a side column only then.
export function hasContactCardContent(contacts?: CityContactsResponse) {
  return Boolean(
    contacts &&
    (contacts.primaryOffice || contacts.portalUrl || contacts.permitsUrl),
  )
}

export function CityContactCard({ contacts, isLoading }: CityContactCardProps) {
  if (isLoading) {
    return (
      <div
        className="border border-[#302d2d]/30 px-5 py-4 text-sm text-[#302d2d]/70"
        role="status"
      >
        Looking up the city permit office…
      </div>
    )
  }

  if (!contacts || !hasContactCardContent(contacts)) {
    return null
  }
  const office = contacts.primaryOffice

  return (
    <section
      aria-label="City permit office"
      className="border border-[#302d2d] px-5 py-5"
    >
      <p className="text-xs font-medium tracking-[0.16em] text-[#1968b4] uppercase">
        City permit office
      </p>
      {office && (
        <>
          <h3 className="mt-1 text-lg leading-6 font-medium text-[#302d2d]">
            {office.name ?? OFFICE_LABELS[office.officeType]}
          </h3>
          <OfficeDetails office={office} />
        </>
      )}

      {contacts.portalUrl && (
        <div className="mt-5 border-t border-[#302d2d]/20 pt-4">
          <p className="text-sm font-medium text-[#302d2d]">Apply online</p>
          <p className="mt-1 text-sm leading-5 text-[#302d2d]/70">
            The city takes permit applications through its online permit portal.
          </p>
          <a
            className="mt-2 inline-block text-sm font-medium text-[#1968b4] underline-offset-2 hover:underline"
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
          className="mt-3 block text-sm font-medium text-[#1968b4] underline-offset-2 hover:underline"
          href={contacts.permitsUrl}
          rel="noreferrer"
          target="_blank"
        >
          City permits page ↗
        </a>
      )}

      {contacts.otherOffices.length > 0 && (
        <div className="mt-5 border-t border-[#302d2d]/20 pt-4">
          <p className="text-xs font-medium tracking-[0.08em] text-[#302d2d]/70 uppercase">
            Other offices
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#302d2d]">
            {contacts.otherOffices.map((other) => (
              <li key={other.officeType}>
                <span className="font-medium">
                  {other.name ?? OFFICE_LABELS[other.officeType]}
                </span>
                {other.phone && (
                  <>
                    {' · '}
                    <a
                      className="hover:text-[#1968b4]"
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
                      className="hover:text-[#1968b4]"
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
        <p className="mt-4 text-xs text-[#302d2d]/70">
          {office?.sourceUrl && (
            <a
              className="underline hover:text-[#1968b4]"
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
        <a className="hover:text-[#1968b4]" href={telHref(office.phone)}>
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
          className="break-all hover:text-[#1968b4]"
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
          <dt className="text-[#302d2d]/70">{label}</dt>
          <dd className="text-[#302d2d]">{value}</dd>
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
