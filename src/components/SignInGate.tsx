import type { ReactNode } from 'react'

import { primaryButtonClass } from '#/components/buttons'
import { SignInButton } from '#/components/SignInDialog'

// What an account-only page shows signed-out visitors: what the page is for,
// and the way in.
export function SignInGate({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-ink pt-5">
      <p className="max-w-[60ch] text-base leading-6 text-ink/70">{children}</p>
      <SignInButton className={`mt-5 ${primaryButtonClass}`} />
    </div>
  )
}
