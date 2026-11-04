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
