import type { Tone } from '#/components/Notice'
import type { PermitCheckResult } from '#/lib/portals/types'

export interface CheckToast {
  tone: Tone
  message: string
}

// The toast for a status check the user asked for. Every outcome gets one,
// including "nothing changed", so a click never ends in silence.
export function checkToast(
  permitNumber: string,
  check: PermitCheckResult,
): CheckToast {
  switch (check.kind) {
    case 'changed':
      return {
        tone: 'success',
        message: `Permit ${permitNumber} is now ${check.status.label}.`,
      }
    case 'unchanged':
      return {
        tone: 'success',
        message: `No change: permit ${permitNumber} is still ${check.status.label}.`,
      }
    case 'recent':
      return {
        tone: 'success',
        message: check.status
          ? `Permit ${permitNumber} is ${check.status.label}. It was checked in the last 15 minutes.`
          : `Permit ${permitNumber} was checked in the last 15 minutes.`,
      }
    case 'failed':
      return { tone: 'error', message: check.message }
  }
}
