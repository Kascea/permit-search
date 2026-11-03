import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { AppPage } from '#/components/AppPage'
import { ProjectForm } from '#/components/ProjectForm'
import { SignInButton } from '#/components/SignInDialog'
import { useAuth } from '#/lib/auth/use-auth'
import { createAccountProject } from '#/lib/projects/projects'
import { setAccountProjects } from '#/lib/projects/use-account-projects'

export const Route = createFileRoute('/projects/new')({
  head: () => ({
    meta: [{ title: 'New project | Permit Search' }],
  }),
  component: NewProject,
})

function NewProject() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <AppPage>
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        New project
      </p>
      <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        Start a project
      </h1>
      <p className="mt-3 max-w-[60ch] text-base leading-6 text-ink/70">
        Enter what permit forms ask for once, and fill it into every form
        for the job. Only the name is required; you can add the rest later.
      </p>

      {user ? (
        <ProjectForm
          variant="create"
          submitLabel="Create project"
          pendingLabel="Creating…"
          onSubmit={async (input) => {
            const { publicId, projects } = await createAccountProject({
              data: input,
            })

            setAccountProjects(projects)
            toast.success('Project created.')
            await navigate({
              to: '/projects/$projectId',
              params: { projectId: publicId },
            })
          }}
          onCancel={() => void navigate({ to: '/projects' })}
        />
      ) : (
        <div className="mt-6 border-t border-ink pt-5">
          <p className="text-base leading-6 text-ink/70">
            Sign in to start a project. Projects are saved to your account.
          </p>
          <SignInButton className="mt-5 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep" />
        </div>
      )}
    </AppPage>
  )
}
