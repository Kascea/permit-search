// Applies pending migrations through the deployed Worker's Hyperdrive binding.
// Usage: npm run db:migrate [-- https://permitsearch.app]
try {
  process.loadEnvFile()
} catch {
  // No .env file: rely on the shell's environment.
}

const baseUrl = process.argv[2] ?? 'https://permitsearch.app'
const token = process.env.MIGRATION_TOKEN
if (!token) {
  console.error('Set MIGRATION_TOKEN in .env first.')
  process.exit(1)
}

const response = await fetch(new URL('/api/db/migrate', baseUrl), {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
})
const body = await response.json().catch(() => ({}))
console.log(JSON.stringify(body, null, 2))
if (!response.ok) {
  process.exit(1)
}
