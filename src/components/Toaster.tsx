import { Toaster as Sonner } from 'sonner'

// Short notices for actions that aren't tied to a form, such as signing out
// or deleting a draft. Show them with toast.error() or toast.success() from
// 'sonner'. Errors about a form's fields stay inline beside the form.
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-3 rounded-[2px] border border-ink bg-paper px-4 py-3 text-sm text-ink shadow-[0_2px_0_var(--color-ink)]',
          error: 'border-redline text-redline',
          success: 'text-ink',
          title: 'font-medium',
          description: 'mt-0.5 text-ink/70',
          icon: 'mt-0.5 shrink-0',
        },
      }}
    />
  )
}
