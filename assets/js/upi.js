/* Shared helpers: UPI payment links, QR codes and Supabase REST access.
 * Used by both the public site (join.js) and the admin dashboard (admin.js). */
(function () {
  "use strict";

  var cfg = window.MH_CONFIG || {};

  function isConfigured() {
    return /^https:\/\/.+/.test(cfg.supabaseUrl || "") && !!cfg.supabaseAnonKey;
  }

  /* Build a standard UPI deep link (NPCI "upi://pay" format). */
  function upiUrl(opts) {
    var params = [
      "pa=" + encodeURIComponent(opts.vpa),
      "pn=" + encodeURIComponent(opts.payee || "")
    ];
    if (opts.amount) params.push("am=" + encodeURIComponent(Number(opts.amount).toFixed(2)));
    params.push("cu=INR");
    if (opts.note) params.push("tn=" + encodeURIComponent(String(opts.note).slice(0, 50)));
    return "upi://pay?" + params.join("&");
  }

  /* Render text as an SVG QR code into an element. */
  function renderQr(el, text) {
    if (!window.qrcode) { el.textContent = "QR code unavailable"; return; }
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
    var qr = window.qrcode(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: "UPI payment QR code" });
    var svg = el.querySelector("svg");
    if (svg) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "UPI payment QR code"); }
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
    return fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
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

  window.MH = { cfg: cfg, isConfigured: isConfigured, upiUrl: upiUrl, renderQr: renderQr, inr: inr, rest: rest };
})();
