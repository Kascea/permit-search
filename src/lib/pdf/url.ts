export function isPdfUrl(value: string) {
  try {
    return new URL(value).pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return false
  }
}
