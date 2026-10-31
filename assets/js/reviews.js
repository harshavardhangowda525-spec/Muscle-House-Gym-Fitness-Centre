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

  // Trustindex first inserts an empty placeholder; wait for the real widget (.ti-widget)
  function ready() { return !!slot.querySelector(".ti-widget"); }
  function rendered() {
    if (!ready()) return false;
    saved.forEach(function (el) { if (el) el.hidden = true; });
    return true;
  }

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
