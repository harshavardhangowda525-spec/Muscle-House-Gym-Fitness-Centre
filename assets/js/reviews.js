/* Muscle House — live Google reviews.
 *
 * Loads the rating, review count and reviews from the "google-reviews" Supabase Edge
 * Function (supabase/functions/google-reviews), which calls the official Google Places
 * API with a key kept on the server. Only runs when googleReviews is true in config.js.
 * If anything fails, the reviews already in the page stay as they are.
 */
(function () {
  "use strict";

  var cfg = (window.MH && window.MH.cfg) || window.MH_CONFIG || {};
  var section = document.getElementById("reviews");
  if (!cfg.googleReviews || !section || !(window.MH && window.MH.isConfigured())) return;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function stars(n) { n = Math.max(0, Math.min(5, Math.round(n))); return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }
  function fmtRating(r) { return (Math.round(r * 10) / 10).toFixed(1).replace(/\.0$/, ""); }

  function render(data) {
    var rating = typeof data.rating === "number" ? fmtRating(data.rating) : null;
    var count = typeof data.count === "number" ? data.count : null;

    if (rating && count !== null) {
      var score = section.querySelector(".score");
      score.setAttribute("aria-label", "Overall Google rating: " + rating + " out of 5, based on " + count + " reviews");
      score.querySelector(".score__num").innerHTML = esc(rating) + "<small>/5</small>";
      score.querySelector(".score__meta strong").textContent = count + " Google reviews";
      var note = section.querySelector("[data-reviews-note]");
      if (note) note.textContent = "Stars on each card show that individual review's rating. The overall rating is " + rating + "/5.";
    }
    if (data.url) section.querySelectorAll("[data-reviews-link]").forEach(function (a) { a.href = data.url; });

    // Fill the existing cards in place, keeping their markup, size and animations.
    var reviews = (data.reviews || []).filter(function (r) { return r && r.text && typeof r.rating === "number"; });
    var cards = section.querySelectorAll(".quote");
    if (reviews.length < cards.length) return; // keep the current cards rather than leave gaps
    cards.forEach(function (card, i) {
      var r = reviews[i];
      var starsEl = card.querySelector(".quote__stars");
      starsEl.textContent = stars(r.rating);
      starsEl.setAttribute("aria-label", r.rating + "-star review");
      card.querySelector("blockquote p").textContent = "“" + r.text.trim() + "”";
      var who = r.authorUrl
        ? '<a href="' + esc(r.authorUrl) + '" target="_blank" rel="noopener nofollow">' + esc(r.author) + "</a>"
        : esc(r.author);
      card.querySelector("figcaption").innerHTML = who + (r.when ? " · " + esc(r.when) : "") + " · Google";
      card.classList.add("quote--live");
    });
  }

  fetch(cfg.supabaseUrl + "/functions/v1/google-reviews", {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey }
  }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }).then(render).catch(function (err) {
    if (window.console) console.warn("Google reviews unavailable, showing saved reviews:", err.message);
  });
})();
