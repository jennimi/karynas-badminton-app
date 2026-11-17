import { createClient } from '@supabase/supabase-js';
import { getActorId } from './actor';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project credentials.'
  );
}

// Every request says which member is using this tab (if they picked one), so the database
// can write "who did it" into the activity log (supabase/migrations/017_activity_log.sql).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => {
      const actor = getActorId();
      if (!actor) return fetch(input, init);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set('x-rally-actor', actor);
      return fetch(input, { ...init, headers });
    },
  },
});
