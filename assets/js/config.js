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
  supabaseUrl: "https://sfpsulaowjjrsctgadye.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcHN1bGFvd2pqcnNjdGdhZHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjUyNDcsImV4cCI6MjEwNzgwMTI0N30.UJt-sicoLRouE4AP19usrbSDEcTnF4sN0NvVct7_tRM",
  // Gym WhatsApp number for enquiries and "Join on WhatsApp": country code + number, digits only
  whatsappNumber: "916363342090",
  // Google sign-in on the website itself (no supabase.co page): the OAuth "Client ID" from
  // Google Cloud → Google Auth Platform → Clients (ends in .apps.googleusercontent.com).
  // Public by design; never put the Client *Secret* here. Leave empty to use the redirect flow.
  googleClientId: "158488207213-137csauhgdb54g82pcs280vsfqbar6ko.apps.googleusercontent.com",
  // Future online payment: paste a payment-gateway link (https://…, e.g. a Razorpay/PayU payment
  // page) and a "Pay online" button appears in the Membership section. Leave empty to hide it.
  paymentUrl: "",
  // Live Google reviews (Trustindex, free plan): paste the widget code Trustindex gives you,
  // or just the ID after "loader.js?" in it. Leave empty to show the saved reviews.
  trustindexWidget: ""
};
