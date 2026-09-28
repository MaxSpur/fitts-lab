import { handle } from '../_shared/handler.js';

// The current hosted runtime injects new secret keys as a JSON dictionary.
// An explicit per-function key is optional; the legacy key is a compatibility fallback.
let injected: Record<string, string> = {};
try { injected = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'); } catch { /* No injected dictionary. */ }
Deno.serve((request: Request) => handle(request, {
  url: Deno.env.get('SUPABASE_URL') ?? '',
  key: Deno.env.get('SERVER_SECRET_KEY') ?? injected.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  origins: Deno.env.get('ALLOWED_ORIGINS') ?? '',
}));
