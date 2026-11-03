import { Toaster as Sonner } from 'sonner'

import { StatusIcon, toneClass } from '#/components/Notice'

// Short notices for actions that aren't tied to a form, such as signing out
// or deleting a draft. Show them with toast.error() or toast.success() from
// 'sonner'. Errors about a form's fields stay inline beside the form, in a
// Notice; both use the same success and error colors and icons.
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      icons={{
        success: <StatusIcon tone="success" />,
        error: <StatusIcon tone="error" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-2.5 rounded-xs border px-4 py-3 text-sm font-medium',
          default: 'border-ink bg-paper text-ink',
          success: toneClass.success,
          error: toneClass.error,
          title: 'font-medium',
          description: 'mt-0.5 font-normal opacity-80',
          icon: 'mt-0.5 shrink-0',
          content: 'min-w-0 flex-1',
          actionButton:
            'ml-2 shrink-0 font-medium underline underline-offset-2 hover:no-underline',
        },
      }}
    />
  )
}
