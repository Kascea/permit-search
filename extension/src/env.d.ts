/// <reference types="chrome" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // The site the extension signs in to. Defaults to permitsearch.app.
  readonly VITE_PERMIT_SEARCH_URL?: string
}
