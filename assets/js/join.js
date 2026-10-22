/* Muscle House — live plan prices and "Join on WhatsApp".
 *
 * Without a configured backend (assets/js/config.js) the page keeps its static
 * prices and "Enquire now" buttons. With one, prices come from the database and
 * each plan gets a "Join on WhatsApp" button: the member logs in (auth.js), then
 * a WhatsApp chat with the gym opens, pre-filled with the plan and the member's
 * details. Payment is arranged with the gym on WhatsApp; the website does not
 * take or record payments.
 */
(function () {
  "use strict";
  var MH = window.MH;
  if (!MH || !MH.isConfigured()) return;

  var plans = {}; // id -> plan row from the database

  /* ---------- Load plans, refresh the cards ---------- */
  Promise.all([
    MH.rest("plans?select=id,name,months,price,sort&order=sort.asc"),
    MH.rest("settings?select=show_sample_notice&id=eq.1")
  ]).then(function (res) {
    res[0].forEach(function (p) { plans[p.id] = p; });
    updateCards(res[1][0] || null);
    resumeAfterRedirect();
  }).catch(function (err) {
    // Keep the static page as-is; enquiries still work.
    if (window.console) console.warn("Membership data unavailable:", err.message);
  });

  function duration(p) { return p.months === 1 ? "1 month" : p.months + " months"; }

  function updateCards(settings) {
    var monthly = plans.monthly ? plans.monthly.price : null;
    var canJoin = !!MH.auth;

    document.querySelectorAll("[data-plan-id]").forEach(function (card) {
      var p = plans[card.getAttribute("data-plan-id")];
      if (!p) { card.hidden = true; return; } // plan deactivated by the admin
      card.querySelector("[data-name]").textContent = p.name;
      card.querySelector("[data-price]").textContent = Number(p.price).toLocaleString("en-IN");
      card.querySelector("[data-period]").textContent = "/ " + (p.months === 1 ? "month" : p.months + " months");
      card.querySelector("[data-per]").textContent = (p.months === 1 ? "" : "≈ ") + MH.inr(Math.round(p.price / p.months)) + " per month";
      var save = card.querySelector("[data-save]");
      if (save) {
        var amount = monthly ? monthly * p.months - p.price : 0;
        save.hidden = !(amount > 0);
        save.textContent = "Save " + MH.inr(amount) + " vs monthly";
      }
      card.querySelectorAll("[data-plan]").forEach(function (a) { a.setAttribute("data-plan", p.name); });

      if (canJoin) {
        card.querySelector("[data-join]").hidden = false;
        card.querySelector("[data-enquire-primary]").hidden = true;
        card.querySelector("[data-enquire-secondary]").hidden = false;
      }
    });

    var notice = document.querySelector("[data-sample-notice]");
    if (notice && settings && settings.show_sample_notice === false) notice.hidden = true;
  }

  /* ---------- Join: log in, then continue on WhatsApp ---------- */
  var dialog = document.getElementById("join-dialog");
  if (!dialog) return;
  var $ = function (sel) { return dialog.querySelector(sel); };

  function startJoin(planId) {
    var p = plans[planId];
    if (!p || !MH.auth) return;
    MH.auth.require({
      plan: planId,
      reason: "Log in or create a free account to join the " + p.name + " plan.",
      then: function () { open(planId); }
    });
  }

  /* Coming back from Google sign-in with ?join=<plan> */
  function resumeAfterRedirect() {
    var plan = new URLSearchParams(location.search).get("join");
    if (!plan || !MH.auth) return;
    // Drop ?join=…; leave any login token in the hash for Supabase to consume.
    history.replaceState(null, "", location.pathname + (/access_token|code=/.test(location.hash) ? location.hash : "#membership"));
    MH.auth.onChange(function once(u) {
      if (u && plan) { var id = plan; plan = null; open(id); }
    });
  }

  function open(planId) {
    var p = plans[planId];
    var u = MH.auth && MH.auth.user();
    if (!p || !u) return;
    var name = MH.auth.name() || (u.email || "").split("@")[0];
    var text =
      "Hi Muscle House! I'd like to join the " + p.name + " plan (" + MH.inr(p.price) + " for " + duration(p) + ").\n\n" +
      "Name: " + name + "\n" +
      (u.email ? "Email: " + u.email + "\n" : "") +
      "\nPlease share the payment details.";

    $("[data-j-plan]").textContent = p.name;
    $("[data-j-amount]").textContent = MH.inr(p.price);
    $("[data-j-duration]").textContent = duration(p);
    $("[data-j-user]").textContent = u.email || name;
    $("[data-j-wa]").href = "https://wa.me/" + MH.cfg.whatsappNumber + "?text=" + encodeURIComponent(text);

    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    window.setTimeout(function () { $("[data-j-wa]").focus(); }, 30);
  }

  function close() {
    if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
  }
  dialog.addEventListener("close", function () { document.body.style.overflow = ""; });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.closest("[data-join-close]")) close();
    if (e.target.closest("[data-j-account]") && MH.auth) { close(); MH.auth.openAccount(); }
    if (e.target.closest("[data-j-wa]")) window.setTimeout(close, 300); // WhatsApp opens in a new tab/app
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-join]");
    if (btn) startJoin(btn.getAttribute("data-join"));
  });
})();
