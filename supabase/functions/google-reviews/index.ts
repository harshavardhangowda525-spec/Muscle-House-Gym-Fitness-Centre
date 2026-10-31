// Muscle House — Google reviews proxy (Supabase Edge Function).
//
// Fetches the gym's rating, review count and the reviews Google makes available
// (up to 5, Google's "most relevant" order) from the official Google Places API (New).
// The Google API key stays here on the server, in Supabase secrets, never in the website.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_PLACES_API_KEY  Google Cloud API key with "Places API (New)" enabled
//   GOOGLE_PLACE_ID        the gym's Place ID (Google's Place ID Finder)
//
// Responses are kept in memory for CACHE_SECONDS and sent with a matching
// Cache-Control header, so Google is called at most a few times a day.

const CACHE_SECONDS = 6 * 60 * 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

let cache: { at: number; body: string } | null = null;

function json(body: string, status: number, maxAge: number) {
  return new Response(body, {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": `public, max-age=${maxAge}` },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json(JSON.stringify({ error: "method_not_allowed" }), 405, 0);

  if (cache && Date.now() - cache.at < CACHE_SECONDS * 1000) {
    return json(cache.body, 200, Math.max(60, Math.round(CACHE_SECONDS - (Date.now() - cache.at) / 1000)));
  }

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const placeId = Deno.env.get("GOOGLE_PLACE_ID");
  if (!key || !placeId) return json(JSON.stringify({ error: "not_configured" }), 503, 0);

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
      },
    });
    if (!res.ok) {
      console.error("Places API error", res.status, await res.text());
      // Serve the last good copy if there is one
      if (cache) return json(cache.body, 200, 300);
      return json(JSON.stringify({ error: "upstream_error" }), 502, 0);
    }
    // deno-lint-ignore no-explicit-any
    const place: any = await res.json();
    const body = JSON.stringify({
      rating: place.rating ?? null,
      count: place.userRatingCount ?? null,
      url: place.googleMapsUri ?? null,
      // deno-lint-ignore no-explicit-any
      reviews: (place.reviews ?? []).map((r: any) => ({
        rating: r.rating ?? null,
        text: r.text?.text ?? r.originalText?.text ?? "",
        when: r.relativePublishTimeDescription ?? "",
        url: r.googleMapsUri ?? null,
        author: r.authorAttribution?.displayName ?? "Google user",
        authorUrl: r.authorAttribution?.uri ?? null,
      })),
      fetchedAt: new Date().toISOString(),
    });
    cache = { at: Date.now(), body };
    return json(body, 200, CACHE_SECONDS);
  } catch (err) {
    console.error("Places API request failed", err);
    if (cache) return json(cache.body, 200, 300);
    return json(JSON.stringify({ error: "upstream_error" }), 502, 0);
  }
});
