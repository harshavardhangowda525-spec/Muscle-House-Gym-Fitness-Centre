/* Muscle House — live Google reviews via Trustindex.
 *
 * When trustindexWidget is set in config.js, loads the Trustindex widget into the
 * Reviews section. Once it has rendered, the saved rating and quote cards are hidden;
 * if it doesn't load (blocked, offline, wrong ID), the saved reviews stay as they are.
 */
(function () {
  "use strict";

  var cfg = window.MH_CONFIG || {};
  // Accept the full pasted embed code or just the widget ID
  var m = /loader\.js\?([A-Za-z0-9]+)/.exec(String(cfg.trustindexWidget || "")) || /^\s*([A-Za-z0-9]{8,})\s*$/.exec(String(cfg.trustindexWidget || ""));
  var section = document.getElementById("reviews");
  var slot = section && section.querySelector("[data-reviews-widget]");
  if (!m || !slot) return;

  var saved = [section.querySelector(".score"), section.querySelector(".quotes"), section.querySelector("[data-reviews-note]")];

  function rendered() {
    if (!slot.querySelector("div, iframe")) return false;
    saved.forEach(function (el) { if (el) el.hidden = true; });
    return true;
  }

  slot.hidden = false;
  var observer = new MutationObserver(function () { if (rendered()) observer.disconnect(); });
  observer.observe(slot, { childList: true, subtree: true });
  // Give up after 10 s and keep the saved reviews
  window.setTimeout(function () {
    observer.disconnect();
    if (!slot.querySelector("div, iframe")) slot.hidden = true;
  }, 10000);

  var s = document.createElement("script");
  s.defer = true; s.async = true;
  s.src = "https://cdn.trustindex.io/loader.js?" + m[1];
  slot.appendChild(s);
})();
