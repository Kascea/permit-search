// What a city asks for with one kind of online application, in a shape
// every provider maps into. Any part can be empty when a portal doesn't say.
export interface PermitRequirements {
  // Uploads, such as "A site plan showing property lines and setbacks".
  documents: Array<string>
  // Short notes, such as "Electrical permits are obtained through the state".
  notes: Array<string>
  // Guides and forms the page links to, such as a deck checklist PDF.
  links: Array<{ label: string; url: string }>
  // The declaration the applicant signs, when the portal shows one.
  declaration: string | null
}

// Provider-specific extras about a permit type that nothing generic reads,
// such as a portal's internal category code.
export type PortalTypeDetails = Record<string, string>

// One kind of application a jurisdiction accepts online, as the browser
// sees it. See portal_permit_types.
export interface PortalPermitType {
  id: number
  provider: string
  // The provider's display name, such as "LOGIS ePermits".
  providerName: string
  jurisdiction: string
  city: { name: string; region: string }
  name: string
  category: string | null
  plansRequired: boolean | null
  pageUrl: string
  applyUrl: string | null
  requirements: PermitRequirements | null
}

// A permit type a search matched to the project, with Jev's probability.
export interface OnlineApplicationMatch extends PortalPermitType {
  score: number
}

// Where a permit is in the city's process, worked out by each provider from
// what its portal shows. 'unknown' when the provider can't tell.
export type PermitPhase =
  | 'applied'
  | 'approved'
  | 'issued'
  | 'finaled'
  | 'cancelled'
  | 'expired'
  | 'unknown'

// The permit as the city's portal showed it at the last check. Dates are ISO
// dates, null when the portal leaves them blank.
export interface PermitStatus {
  phase: PermitPhase
  // For people, such as "Issued" or "Approved, fees due".
  label: string
  permitType: string | null
  description: string | null
  dates: {
    applied: string | null
    approved: string | null
    issued: string | null
    finaled: string | null
    cancelled: string | null
    expires: string | null
  }
  // Unpaid application and permit fees, in cents; null when not shown.
  balanceDueCents: number | null
  // The permit's own page, for a provider whose check finds a link that its
  // number alone can't build. Otherwise the provider's permitUrl is used.
  permitUrl?: string
}

// What a status check did, so the page can always say so, even when nothing
// changed. 'recent' reused a check from the last few minutes without asking
// the portal again.
export type PermitCheckResult =
  | { kind: 'changed'; status: PermitStatus }
  | { kind: 'unchanged'; status: PermitStatus }
  | { kind: 'recent'; status: PermitStatus | null }
  | { kind: 'failed'; message: string }

// The city permit filed for a form in a project.
export interface TrackedPermit {
  provider: string
  jurisdiction: string
  // Normalized, such as "SL306008".
  permitNumber: string
  // Null until the first successful check.
  status: PermitStatus | null
  checkedAt: string | null
  // The last check's failure, written for the user.
  checkError: string | null
  // The permit's own page on the city's portal.
  permitUrl: string
}
