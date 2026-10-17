/* Muscle House — live plan prices and the "Join & pay" UPI flow.
 *
 * Without a configured backend (assets/js/config.js) the page keeps its static
 * prices and "Enquire now" buttons. With one, prices come from the database
 * and members can pay by UPI QR. Payments are never auto-confirmed: the
 * request is stored as "pending" until the gym owner verifies it.
 */
(function () {
  "use strict";
  var MH = window.MH;
  if (!MH || !MH.isConfigured()) return;

  var plans = {};      // id -> plan row from the database
  var settings = null; // { upi_id, payee_name, show_sample_notice }

  /* ---------- Load plans + payment settings, refresh the cards ---------- */
  Promise.all([
    MH.rest("plans?select=id,name,months,price,sort&order=sort.asc"),
    MH.rest("settings?select=upi_id,payee_name,show_sample_notice&id=eq.1")
  ]).then(function (res) {
    res[0].forEach(function (p) { plans[p.id] = p; });
    settings = res[1][0] || null;
    updateCards();
  }).catch(function (err) {
    // Keep the static page as-is; enquiries still work.
    if (window.console) console.warn("Membership data unavailable:", err.message);
  });

  function updateCards() {
    var monthly = plans.monthly ? plans.monthly.price : null;
    var canPay = !!(settings && settings.upi_id && settings.payee_name);

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

      if (canPay) {
        card.querySelector("[data-join]").hidden = false;
        card.querySelector("[data-enquire-primary]").hidden = true;
        card.querySelector("[data-enquire-secondary]").hidden = false;
      }
    });

    var notice = document.querySelector("[data-sample-notice]");
    if (notice && settings && settings.show_sample_notice === false) notice.hidden = true;
  }

  /* ---------- Dialog ---------- */
  var dialog = document.getElementById("join-dialog");
  if (!dialog) return;
  var $ = function (sel) { return dialog.querySelector(sel); };
  var state = { plan: null, name: "", phone: "", ref: "" };

  function showStep(n) {
    dialog.querySelectorAll("[data-step]").forEach(function (s) { s.hidden = s.getAttribute("data-step") !== String(n); });
    dialog.querySelectorAll("[data-step-dot]").forEach(function (d) {
      var k = Number(d.getAttribute("data-step-dot"));
      d.classList.toggle("is-current", k === n);
      d.classList.toggle("is-done", k < n);
    });
    var focusTarget = n === 1 ? "#j-name" : n === 2 ? "#j-ref" : "[data-j-done]";
    window.setTimeout(function () { var el = $(focusTarget); if (el) el.focus(); }, 30);
  }

  function open(planId) {
    var p = plans[planId];
    if (!p || !settings || !settings.upi_id) return;
    state.plan = p;
    $("[data-j-plan]").textContent = p.name;
    $("[data-j-amount]").textContent = MH.inr(p.price);
    $("[data-j-duration]").textContent = p.months === 1 ? "1 month" : p.months + " months";
    $("[data-j-error]").hidden = true;
    $("[data-join-pay]").reset();
    setError("j-ref", "");
    showStep(1);
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
  }
  dialog.addEventListener("close", function () { document.body.style.overflow = ""; });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) close();                 // click on backdrop
    if (e.target.closest("[data-join-close]")) close();
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-join]");
    if (btn) open(btn.getAttribute("data-join"));
  });

  /* ---------- Validation ---------- */
  function setError(id, msg) {
    var input = document.getElementById(id);
    var field = input.closest(".field");
    field.classList.toggle("has-error", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    document.getElementById(id + "-err").textContent = msg;
    return !msg;
  }
  function normalisePhone(raw) {
    var m = raw.replace(/[\s\-().]/g, "").match(/^(?:\+?91|0)?([6-9]\d{9})$/);
    return m ? m[1] : null;
  }
  function normaliseRef(raw) {
    var v = raw.replace(/[\s-]/g, "").toUpperCase();
    return /^[A-Z0-9]{6,35}$/.test(v) ? v : null;
  }

  /* Step 1 → 2 */
  $("[data-join-details]").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#j-name").value.trim();
    var phone = normalisePhone($("#j-phone").value);
    var ok = setError("j-name",
      !name ? "Please enter your full name." :
      name.length < 2 ? "Name should be at least 2 characters." :
      !/^[\p{L}][\p{L}\s.'-]*$/u.test(name) ? "Please use letters only." : "");
    ok = setError("j-phone", phone ? "" : "Enter a valid 10-digit Indian mobile number.") && ok;
    if (!ok) { $(".has-error input").focus(); return; }

    state.name = name; state.phone = phone;
    var p = state.plan;
    var link = MH.upiUrl({
      vpa: settings.upi_id,
      payee: settings.payee_name,
      amount: p.price,
      note: "Muscle House " + p.name + " - " + name
    });
    MH.renderQr($("[data-j-qr]"), link);
    $("[data-j-payee]").textContent = settings.payee_name;
    $("[data-j-vpa]").textContent = settings.upi_id;
    $("[data-j-amount2]").textContent = MH.inr(p.price);
    $("[data-j-app]").href = link;
    showStep(2);
  });

  $("[data-j-back]").addEventListener("click", function () { showStep(1); });

  $("[data-j-copy]").addEventListener("click", function (e) {
    var btn = e.currentTarget;
    var done = function () { btn.textContent = "Copied"; window.setTimeout(function () { btn.textContent = "Copy"; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(settings.upi_id).then(done, function () {});
  });

  /* Step 2 → 3: store the request as pending */
  $("[data-join-pay]").addEventListener("submit", function (e) {
    e.preventDefault();
    var ref = normaliseRef($("#j-ref").value);
    if (!setError("j-ref", ref ? "" : "Enter the UPI transaction ID from your receipt (letters and numbers, usually 12 digits).")) {
      $("#j-ref").focus(); return;
    }
    var submit = $("[data-j-submit]");
    var errBox = $("[data-j-error]");
    errBox.hidden = true;
    submit.disabled = true; submit.textContent = "Submitting…";

    MH.rest("memberships", {
      method: "POST",
      prefer: "return=minimal",
      body: { full_name: state.name, phone: state.phone, plan_id: state.plan.id, upi_ref: ref }
    }).then(function () {
      state.ref = ref;
      $("[data-j-amount3]").textContent = MH.inr(state.plan.price);
      $("[data-j-ref]").textContent = ref;
      $("[data-j-plan2]").textContent = state.plan.name;
      $("[data-j-phone]").textContent = "+91 " + state.phone;
      $("[data-join-details]").reset();
      showStep(3);
    }).catch(function (err) {
      var msg =
        err.code === "23505" ? "This transaction ID has already been submitted. If you think this is a mistake, please call the gym." :
        err.code === "P0001" ? "There are already several pending requests for this phone number. Please call the gym." :
        err.status ? "We couldn't save your request. Please check the transaction ID and try again." :
        "We couldn't reach the server. Check your connection and try again.";
      errBox.innerHTML = "<strong>Nothing was submitted.</strong>" + msg + ' You can also call <a href="tel:+916363342090">063633 42090</a>.';
      errBox.hidden = false;
    }).then(function () {
      submit.disabled = false; submit.textContent = "Submit for verification";
    });
  });
})();
