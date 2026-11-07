import { useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'

import { Modal, ModalCloseButton, modalPanelClass } from '#/components/Modal'
import { authClient, signInWithGoogle } from '#/lib/auth/auth-client'
import { rememberResume } from '#/lib/auth/resume'
import { Notice } from '#/components/Notice'

type Mode = 'sign-in' | 'sign-up'

interface SignInOptions {
  // Why they're being asked, shown under the title.
  reason?: string
  // What to finish once they've signed in; see useResumeAfterSignIn.
  resume?: string
  initialMode?: Mode
}

interface SignInDialogProps extends SignInOptions {
  isOpen: boolean
  onClose: () => void
}

// Email and password sign-in or account creation, with Google as an option.
export function SignInDialog({ isOpen, onClose, ...options }: SignInDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      label="Sign in"
      widthClass="max-w-105"
      onClose={onClose}
    >
      <SignInForm onClose={onClose} {...options} />
    </Modal>
  )
}

// A button that opens the sign-in dialog. Pass a className to restyle it.
export function SignInButton({
  className = 'shrink-0 rounded-full bg-blueprint px-3 py-1.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint',
  children = 'Sign in',
  title,
  ariaLabel,
  ...options
}: SignInOptions & {
  className?: string
  children?: ReactNode
  title?: string
  ariaLabel?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        title={title}
        onClick={() => setIsOpen(true)}
      >
        {children}
      </button>
      <SignInDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        {...options}
      />
    </>
  )
}

function SignInForm({
  onClose,
  reason,
  resume,
  initialMode = 'sign-in',
}: SignInOptions & { onClose: () => void }) {
  const router = useRouter()
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  const isSignUp = mode === 'sign-up'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if ((isSignUp && !name.trim()) || !email.trim() || !password) {
      setError(
        isSignUp
          ? 'Enter your name, email, and a password.'
          : 'Enter your email and password.',
      )

      return
    }

    if (isSignUp && password.length < 8) {
      setError('Use a password with at least 8 characters.')

      return
    }

    setError('')
    setIsBusy(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await authClient.signIn.email({ email: email.trim(), password })

      if (result.error) {
        setError(authErrorMessage(result.error, isSignUp))

        return
      }

      if (resume) rememberResume(resume)

      onClose()
      // Reloads the root loader's sign-in state.
      await router.invalidate()

      // Signing in from the home page opens the app; elsewhere it stays put.
      if (window.location.pathname === '/') {
        await router.navigate({ to: '/dashboard' })
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <form
      className={`bg-paper ${modalPanelClass}`}
      noValidate
      onSubmit={submit}
    >
      <div className="mb-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-ink">
            {isSignUp ? 'Create an account' : 'Sign in'}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        {reason && <p className="mt-1 text-sm text-ink/70">{reason}</p>}
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-ink px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5"
        onClick={() => {
          if (resume) rememberResume(resume)

          void signInWithGoogle(
            window.location.pathname === '/'
              ? '/dashboard'
              : window.location.pathname + window.location.search,
          )
        }}
      >
        <GoogleMark />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs tracking-[0.08em] text-ink/60 uppercase">
        <span className="h-px flex-1 bg-ink/20" />
        or
        <span className="h-px flex-1 bg-ink/20" />
      </div>

      <div className="space-y-3">
        {isSignUp && (
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-ink"
              htmlFor={nameId}
            >
              Name
            </label>
            <input
              id={nameId}
              className="field-input"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        )}
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-ink"
            htmlFor={emailId}
          >
            Email
          </label>
          <input
            id={emailId}
            className="field-input"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-ink"
            htmlFor={passwordId}
          >
            Password
          </label>
          <input
            id={passwordId}
            className="field-input"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {isSignUp && (
            <p className="mt-1.5 text-xs text-ink/60">At least 8 characters.</p>
          )}
        </div>
      </div>

      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}

      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint disabled:cursor-wait disabled:opacity-60"
        disabled={isBusy}
      >
        {isBusy
          ? isSignUp
            ? 'Creating account…'
            : 'Signing in…'
          : isSignUp
            ? 'Create account'
            : 'Sign in'}
      </button>

      <p className="mt-4 text-center text-sm text-ink/70">
        {isSignUp ? 'Already have an account?' : 'New to Permit Search?'}{' '}
        <button
          type="button"
          className="font-medium text-blueprint underline-offset-2 hover:underline"
          onClick={() => {
            setMode(isSignUp ? 'sign-in' : 'sign-up')
            setError('')
          }}
        >
          {isSignUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </form>
  )
}

function authErrorMessage(
  error: { code?: string; message?: string },
  isSignUp: boolean,
) {
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'That email and password don’t match an account.'
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'An account with that email already exists. Sign in instead.'
    case 'INVALID_EMAIL':
      return 'Enter a valid email address.'
    case 'PASSWORD_TOO_SHORT':
      return 'Use a password with at least 8 characters.'
    case 'PASSWORD_TOO_LONG':
      return 'Use a password with at most 128 characters.'
    // Other messages come from better-auth and aren't written for people.
    default:
      return isSignUp
        ? 'Your account couldn’t be created. Try again.'
        : 'You couldn’t be signed in. Try again.'
  }
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}
