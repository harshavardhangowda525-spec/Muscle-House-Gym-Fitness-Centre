/* Muscle House — backend configuration.
 *
 * Paste the values from Supabase → Project Settings → API:
 *   supabaseUrl      "Project URL", e.g. https://abcdxyz.supabase.co
 *   supabaseAnonKey  "anon" / "public" key (safe to publish; access is limited
 *                    by the row-level security rules in supabase/schema.sql)
 *
 * NEVER put the "service_role" key here.
 * While these are empty, the site falls back to enquiries only and the admin
 * page shows setup instructions.
 */
window.MH_CONFIG = {
  supabaseUrl: "https://sfpsulaowjjrsctgadye.supabase.co/rest/v1/"
,
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcHN1bGFvd2pqcnNjdGdhZHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjUyNDcsImV4cCI6MjEwNzgwMTI0N30.UJt-sicoLRouE4AP19usrbSDEcTnF4sN0NvVct7_tRM"
};
