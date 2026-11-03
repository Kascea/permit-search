import { toast } from 'sonner'

// Copies a value and says so, such as "Owner phone copied."
export async function copyWithToast(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  } catch {
    toast.error('Your browser wouldn’t copy that.')
  }
}
