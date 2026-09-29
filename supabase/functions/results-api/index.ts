import {handle} from './handler.js';
Deno.serve((request: Request) => handle(request, {
  url: Deno.env.get('SUPABASE_URL'),
  key: Deno.env.get('SERVER_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  origins: Deno.env.get('ALLOWED_ORIGINS'),
}));
