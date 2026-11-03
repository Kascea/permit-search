export function isPdfUrl(value: string) {
  try {
    const pathname = new URL(value).pathname.toLowerCase()

    // CivicPlus document centers, which many city sites use, serve files from
    // extensionless links that end in the file type, such as
    // /DocumentCenter/View/3373/Residential-Retaining-Wall-PDF.
    return (
      pathname.endsWith('.pdf') ||
      /\/documentcenter\/view\/.*[-_]pdf$/.test(pathname)
    )
  } catch {
    return false
  }
}
