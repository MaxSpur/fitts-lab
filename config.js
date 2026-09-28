/** Public configuration. These values are delivered to every browser.
 * NEVER put a Supabase secret/service-role key or an instructor password here.
 * Empty backend values leave the complete standalone and local-rehearsal modes enabled.
 */
export const CONFIG = Object.freeze({
  supabaseUrl: 'https://qzlzetebjbytxamzhliq.supabase.co', // Example: https://YOUR_PROJECT_REF.supabase.co (no trailing slash)
  publishableKey: 'sb_publishable_tLXbXVwAFlhqgOS8s2twfA_newTkLTo', // sb_publishable_... (a legacy anon key also works)
  classroomSlug: 'hci', // One stable public classroom name, owned by your instructor account.
  apiFunction: 'classroom-api',
  uploadIntervalMs: 1000,
  batchSize: 16,
  instructorPollMs: 5000, // Durable reconciliation; WebSocket messages normally arrive earlier.
  participantPollMs: 6000,
  maxLocalTrials: 50000,
});
