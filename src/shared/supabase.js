// The one door to the database. Read-only, from the app's side.
//
// The key below is the project's public (anon) key: it's meant to ship inside
// the app, and it can't be used to change anything. What it's allowed to do is
// decided by the database's own rules (supabase/schema.sql) — read the Base
// pack, read its revision counter, nothing else. The key that can write never
// leaves the Supabase dashboard.
export const SUPABASE_URL = 'https://pigacurtzpgvfppkfbtw.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ2FjdXJ0enBndmZwcGtmYnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjcxMTQsImV4cCI6MjEwNTIwMzExNH0.sxbXHOFddclqn81w9AX9ICjba28S_iivMwDrypL7j1M'

// GET /rest/v1/<path>. Never from a cache — the whole point of asking is to
// hear what's there now.
//
// Pages go in the address (limit/offset), never in a Range header. With Range,
// Safari on the iPhone answered the Base download with an old copy while the
// revision request, identical but for that header, came back fresh: the phone
// saved "revision 3" holding revision 2's pairs, and had no reason to ask again.
export async function rest(path) {
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, cache: 'no-store' })
  if (!res.ok) throw new Error(`supabase ${res.status}`)
  return res.json()
}
