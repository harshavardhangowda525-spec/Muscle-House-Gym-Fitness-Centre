/* Muscle House — live Google reviews via Trustindex.
 *
 * When trustindexWidget is set in config.js, loads the Trustindex widget into the
 * Reviews section. Once it has rendered, the saved rating and quote cards are hidden;
 * if it doesn't load (blocked, offline, wrong ID), the saved reviews stay as they are.
 *
 * It also reads the live Google rating and review count from the same Trustindex data
 * and updates the hero badge, the Reviews score and the chat answer, so the count goes
 * up by itself whenever Trustindex picks up a new review.
 */
(function () {
  "use strict";

  var cfg = window.MH_CONFIG || {};
  // Accept the full pasted embed code or just the widget ID
  var m = /loader\.js\?([A-Za-z0-9]+)/.exec(String(cfg.trustindexWidget || "")) || /^\s*([A-Za-z0-9]{8,})\s*$/.exec(String(cfg.trustindexWidget || ""));
  var section = document.getElementById("reviews");
  var slot = section && section.querySelector("[data-reviews-widget]");
  if (!m) return;

  /* ---------- Live rating + review count ---------- */
  function applyStats(rating, count) {
    var r = rating.toFixed(1);
    window.MHReviewStats = { rating: r, count: count };
    document.querySelectorAll("[data-g-rating]").forEach(function (el) { el.textContent = r + "/5"; });
    document.querySelectorAll("[data-g-count]").forEach(function (el) { el.textContent = count + " reviews"; });
    var score = section && section.querySelector(".score");
    if (score) {
      score.setAttribute("aria-label", "Overall Google rating: " + r + " out of 5, based on " + count + " reviews");
      score.querySelector(".score__num").innerHTML = r + "<small>/5</small>";
      score.querySelector(".score__meta strong").textContent = count + " Google reviews";
    }
    var note = section && section.querySelector("[data-reviews-note]");
    if (note) note.textContent = "Stars on each card show that individual review's rating. The overall rating is " + r + "/5.";
  }
  var id = m[1];
  fetch("https://cdn.trustindex.io/widgets/" + id.slice(0, 2) + "/" + id + "/content.html")
    .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.text(); })
    .then(function (html) {
      var r = /ti-header-rating">\s*([0-9]+(?:[.,][0-9]+)?)\s*</.exec(html);
      var c = /ti-header-rating-reviews">\s*([0-9][0-9,.]*)/.exec(html);
      var rating = r && parseFloat(r[1].replace(",", ".")), count = c && parseInt(c[1].replace(/[,.]/g, ""), 10);
      if (rating >= 1 && rating <= 5 && count > 0) applyStats(rating, count);
    })
    .catch(function () { /* keep the numbers already in the page */ });

  if (!slot) return;

  var saved = [section.querySelector(".score"), section.querySelector(".quotes"), section.querySelector("[data-reviews-note]")];

  // Trustindex first inserts an empty placeholder, and it can also send a notice instead of
  // reviews (e.g. "trial expired"). Only a real widget with at least one review counts.
  function ready() { var w = slot.querySelector(".ti-widget"); return !!w && !!w.querySelector(".ti-name, .ti-review-item"); }
  function rendered() {
    if (!ready()) return false;
    slot.classList.remove("is-pending");
    saved.forEach(function (el) { if (el) el.hidden = true; });
    return true;
  }

  // Keep the slot invisible (but in the page, so Trustindex can lazy-load) until reviews arrive
  slot.classList.add("is-pending");
  slot.hidden = false;
  var observer = new MutationObserver(function () { if (rendered()) observer.disconnect(); });
  observer.observe(slot, { childList: true, subtree: true });
  // Trustindex loads the widget when it scrolls into view; if it hasn't appeared
  // 10 s after that, give up and keep the saved reviews.
  function giveUpLater() {
    window.setTimeout(function () {
      if (ready()) return;
      observer.disconnect();
      slot.hidden = true;
    }, 10000);
  }
  if ("IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { seen.disconnect(); giveUpLater(); }
    });
    seen.observe(section);
  } else {
    giveUpLater();
  }

  var s = document.createElement("script");
  s.defer = true; s.async = true;
  s.src = "https://cdn.trustindex.io/loader.js?" + m[1];
  slot.appendChild(s);
})();
