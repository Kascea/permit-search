import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { AppPage } from '#/components/AppPage'
import { Modal, ModalCloseButton, modalPanelClass } from '#/components/Modal'
import { Notice } from '#/components/Notice'
import type { Tone } from '#/components/Notice'
import { SignInGate } from '#/components/SignInGate'
import { authClient, settled, signInWithGoogle } from '#/lib/auth/auth-client'
import type { AccountUser } from '#/lib/auth/session'
import { useAuth } from '#/lib/auth/use-auth'

export const Route = createFileRoute('/settings')({
  head: () => ({
    meta: [{ title: 'Settings | Permit Search' }],
  }),
  component: Settings,
})

// How the user signs in. Google accounts only ever sign in through Google;
// password accounts manage their password here.
type SignInMethod = 'password' | 'google'

const buttonClass =
  'rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint disabled:cursor-wait disabled:opacity-60'

const secondaryButtonClass =
  'rounded-full border border-ink/35 px-4 py-2 text-sm font-medium transition hover:border-ink disabled:opacity-50'

function Settings() {
  const { user } = useAuth()
  const [method, setMethod] = useState<SignInMethod>()

  useEffect(() => {
    if (!user) return
    void settled(authClient.listAccounts()).then(({ data }) => {
      // Without the list, a password account would look like a Google one.
      if (!data) {
        toast.error(
          'Your sign-in details couldn’t be loaded. Reload to try again.',
        )

        return
      }

      setMethod(
        data.some((account) => account.providerId === 'credential')
          ? 'password'
          : 'google',
      )
    })
  }, [user])

  return (
    <AppPage>
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        Settings
      </p>
      <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        Your account
      </h1>

      {user ? (
        <>
          <ProfileSection user={user} />
          <SignInSection user={user} method={method} />
          <DevicesSection />
          <DeleteSection method={method} />
        </>
      ) : (
        <SignInGate>Sign in to manage your account.</SignInGate>
      )}
    </AppPage>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="mt-8 grid gap-4 border-t border-ink pt-5 sm:grid-cols-[13.75rem_1fr] sm:gap-8">
      <div>
        <h2 className="font-medium text-ink">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-ink/60">{description}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Message({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Notice tone={tone} className="mt-3 w-fit">
      {children}
    </Notice>
  )
}

function ProfileSection({ user }: { user: AccountUser }) {
  const router = useRouter()
  const nameId = useId()
  const [name, setName] = useState(user.name)
  const [isSaving, setIsSaving] = useState(false)

  const [message, setMessage] = useState<{
    tone: Tone
    text: string
  }>()

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setMessage({ tone: 'error', text: 'Enter your name.' })

      return
    }

    setIsSaving(true)
    setMessage(undefined)
    const { error } = await settled(authClient.updateUser({ name: trimmed }))
    setIsSaving(false)

    if (error) {
      setMessage({ tone: 'error', text: 'Your name couldn’t be saved.' })

      return
    }

    setMessage({ tone: 'success', text: 'Saved.' })
    await router.invalidate()
  }

  return (
    <Section title="Profile" description="Your name appears in the header.">
      <form noValidate onSubmit={save}>
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
        <p className="mt-3 text-sm text-ink/60">
          Email: <span className="text-ink">{user.email}</span>
        </p>
        <button
          type="submit"
          className={`mt-4 ${buttonClass}`}
          disabled={isSaving || name.trim() === user.name}
        >
          {isSaving ? 'Saving…' : 'Save name'}
        </button>
        {message && <Message tone={message.tone}>{message.text}</Message>}
      </form>
    </Section>
  )
}

function SignInSection({
  user,
  method,
}: {
  user: AccountUser
  method?: SignInMethod
}) {
  if (!method) {
    return (
      <Section title="Sign-in">
        <p className="text-sm text-ink/60">Loading…</p>
      </Section>
    )
  }

  if (method === 'google') {
    return (
      <Section title="Sign-in">
        <p className="text-base leading-6 text-ink/70">
          You sign in with Google as{' '}
          <span className="font-medium text-ink">{user.email}</span>. Manage
          your password and security in your Google account.
        </p>
      </Section>
    )
  }

  return <PasswordSection />
}

function PasswordSection() {
  const currentId = useId()
  const nextId = useId()
  const confirmId = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [message, setMessage] = useState<{
    tone: Tone
    text: string
  }>()

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!current || !next) {
      setMessage({
        tone: 'error',
        text: 'Enter your current and new password.',
      })

      return
    }

    if (next.length < 8) {
      setMessage({
        tone: 'error',
        text: 'Use a new password with at least 8 characters.',
      })

      return
    }

    if (next !== confirm) {
      setMessage({ tone: 'error', text: 'The new passwords don’t match.' })

      return
    }

    setIsSaving(true)
    setMessage(undefined)

    const { error } = await settled(
      authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      }),
    )

    setIsSaving(false)

    if (error) {
      setMessage({
        tone: 'error',
        text:
          error.code === 'INVALID_PASSWORD'
            ? 'Your current password is incorrect.'
            : 'Your password couldn’t be changed.',
      })

      return
    }

    setCurrent('')
    setNext('')
    setConfirm('')
    setMessage({
      tone: 'success',
      text: 'Password changed. Other devices were signed out.',
    })
  }

  const fields = [
    {
      id: currentId,
      label: 'Current password',
      value: current,
      set: setCurrent,
      autoComplete: 'current-password',
    },
    {
      id: nextId,
      label: 'New password',
      value: next,
      set: setNext,
      autoComplete: 'new-password',
    },
    {
      id: confirmId,
      label: 'Confirm new password',
      value: confirm,
      set: setConfirm,
      autoComplete: 'new-password',
    },
  ]

  return (
    <Section
      title="Password"
      description="Changing it signs you out on other devices."
    >
      <form noValidate onSubmit={save} className="space-y-3">
        {fields.map((field) => (
          <div key={field.id}>
            <label
              className="mb-1.5 block text-sm font-medium text-ink"
              htmlFor={field.id}
            >
              {field.label}
            </label>
            <input
              id={field.id}
              className="field-input"
              type="password"
              autoComplete={field.autoComplete}
              maxLength={128}
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
            />
          </div>
        ))}
        <button
          type="submit"
          className={`mt-1 ${buttonClass}`}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Change password'}
        </button>
        {message && <Message tone={message.tone}>{message.text}</Message>}
      </form>
    </Section>
  )
}

interface DeviceSession {
  token: string
  userAgent?: string | null
  createdAt: Date
}

function DevicesSection() {
  const { data: current } = authClient.useSession()
  const [sessions, setSessions] = useState<Array<DeviceSession>>()
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await settled(authClient.listSessions())
    setSessions(data ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function signOutOthers() {
    setIsBusy(true)
    setError('')

    const { error: revokeError } = await settled(
      authClient.revokeOtherSessions(),
    )

    if (revokeError) setError('Other devices couldn’t be signed out.')
    await load()
    setIsBusy(false)
  }

  const others =
    sessions?.filter((session) => session.token !== current?.session.token) ??
    []

  return (
    <Section title="Devices" description="Where you’re signed in.">
      {sessions === undefined ? (
        <p className="text-sm text-ink/60">Loading…</p>
      ) : (
        <ul className="divide-y divide-ink/20 border-y border-ink/20">
          {sessions.map((session) => (
            <li key={session.token} className="flex items-baseline gap-3 py-3">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {describeDevice(session.userAgent)}
              </span>
              <span className="shrink-0 text-xs text-ink/60">
                {session.token === current?.session.token
                  ? 'This device'
                  : `Since ${new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <button
          type="button"
          className={`mt-4 ${secondaryButtonClass}`}
          disabled={isBusy}
          onClick={() => void signOutOthers()}
        >
          Sign out of other devices
        </button>
      )}
      {error && <Message tone="error">{error}</Message>}
    </Section>
  )
}

// "Chrome on macOS" from a user agent string.
function describeDevice(userAgent?: string | null) {
  if (!userAgent) return 'Unknown device'

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser'

  const os = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : ''

  return os ? `${browser} on ${os}` : browser
}

function DeleteSection({ method }: { method?: SignInMethod }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Section
      title="Delete account"
      description="Permanently deletes your account and saved drafts."
    >
      <button
        type="button"
        className="rounded-full border border-redline px-4 py-2 text-sm font-medium text-redline transition hover:bg-redline hover:text-paper disabled:opacity-50"
        disabled={!method}
        onClick={() => setIsOpen(true)}
      >
        Delete my account
      </button>

      <Modal
        isOpen={isOpen}
        label="Delete account"
        widthClass="max-w-110"
        onClose={() => setIsOpen(false)}
      >
        {method && (
          <DeleteAccountForm method={method} onClose={() => setIsOpen(false)} />
        )}
      </Modal>
    </Section>
  )
}

function DeleteAccountForm({
  method,
  onClose,
}: {
  method: SignInMethod
  onClose: () => void
}) {
  const router = useRouter()
  const passwordId = useId()
  const [password, setPassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  // Google accounts confirm by signing in again when the session is old.
  const [needsGoogle, setNeedsGoogle] = useState(false)
  const [error, setError] = useState('')

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (method === 'password' && !password) {
      setError('Enter your password to confirm.')

      return
    }

    setError('')
    setIsDeleting(true)

    const { error: deleteError } = await settled(
      authClient.deleteUser(method === 'password' ? { password } : {}),
    )

    setIsDeleting(false)

    if (deleteError) {
      if (deleteError.code === 'SESSION_EXPIRED') {
        setNeedsGoogle(true)
      } else {
        setError(
          deleteError.code === 'INVALID_PASSWORD'
            ? 'That password is incorrect.'
            : 'Your account couldn’t be deleted. Try again.',
        )
      }

      return
    }

    onClose()
    await router.navigate({ to: '/' })
    await router.invalidate()
  }

  return (
    <form
      className={`bg-paper ${modalPanelClass}`}
      noValidate
      onSubmit={deleteAccount}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-ink">Delete your account?</h2>
        <ModalCloseButton onClick={onClose} />
      </div>
      <p className="text-base leading-6 text-ink/70">
        This permanently deletes your account and every saved draft. It can’t be
        undone.
      </p>

      {method === 'password' && (
        <div className="mt-4">
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
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      )}

      {needsGoogle && (
        <div className="mt-4 border border-ink/20 p-4 text-base leading-6 text-ink/70">
          For your security, confirm it’s you by signing in with Google again,
          then delete your account.
          <button
            type="button"
            className="mt-3 block font-medium text-blueprint underline-offset-2 hover:underline"
            onClick={() => void signInWithGoogle('/settings')}
          >
            Sign in with Google again
          </button>
        </div>
      )}

      {error && <Message tone="error">{error}</Message>}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isDeleting || needsGoogle}
          className="rounded-full bg-redline px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isDeleting ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
    </form>
  )
}
