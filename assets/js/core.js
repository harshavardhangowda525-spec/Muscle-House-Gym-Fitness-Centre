/* Shared helpers: configuration, rupee formatting and Supabase REST access.
 * Used by both the public site (auth.js, join.js) and the admin dashboard (admin.js). */
(function () {
  "use strict";

  var cfg = window.MH_CONFIG || {};
  // Accept a pasted URL with extra path (e.g. ".../rest/v1/") or whitespace.
  cfg.supabaseUrl = String(cfg.supabaseUrl || "").trim().replace(/\/+(rest|auth)\/v1\/?.*$/, "").replace(/\/+$/, "");
  cfg.supabaseAnonKey = String(cfg.supabaseAnonKey || "").trim();
  cfg.whatsappNumber = String(cfg.whatsappNumber || "916363342090").replace(/\D/g, "");

  function isConfigured() {
    return /^https:\/\/.+/.test(cfg.supabaseUrl || "") && !!cfg.supabaseAnonKey;
  }

  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  /* Minimal anonymous REST client for the public site (no auth needed). */
  function rest(path, options) {
    options = options || {};
    var headers = {
      apikey: cfg.supabaseAnonKey,
      Authorization: "Bearer " + cfg.supabaseAnonKey,
      Accept: "application/json"
    };
    if (options.body) headers["Content-Type"] = "application/json";
    if (options.prefer) headers.Prefer = options.prefer;
    return fetch(cfg.supabaseUrl + "/rest/v1/" + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      if (res.ok) return res.status === 204 || res.status === 201 ? null : res.json();
      return res.json().catch(function () { return {}; }).then(function (err) {
        var e = new Error(err.message || "Request failed");
        e.status = res.status; e.code = err.code; e.details = err.details;
        throw e;
      });
    });
  }

  window.MH = { cfg: cfg, isConfigured: isConfigured, inr: inr, rest: rest };
})();
