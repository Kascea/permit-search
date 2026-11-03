/// <reference types="vite/client" />

// pdf.js's worker, loaded on the server to read forms in the same thread.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: object
}
