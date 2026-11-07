/* Muscle House Gym & Fitness Centre — site behaviour */
(function () {
  "use strict";

  // Business WhatsApp number for the enquiry hand-off; set in assets/js/config.js.
  function whatsappNumber() {
    return String((window.MH_CONFIG && window.MH_CONFIG.whatsappNumber) || "916363342090").replace(/\D/g, "");
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Membership "WhatsApp us" uses the configured number ---------- */
  document.querySelectorAll("[data-call-wa]").forEach(function (a) {
    a.href = "https://wa.me/" + whatsappNumber() + "?text=" + encodeURIComponent("Hi Muscle House! I'd like to know about your membership plans.");
  });

  /* ---------- Future online payment: shown only when paymentUrl is set in config.js ---------- */
  var payUrl = String((window.MH_CONFIG && window.MH_CONFIG.paymentUrl) || "").trim();
  if (/^https:\/\//i.test(payUrl)) {
    document.querySelectorAll("[data-pay-online]").forEach(function (a) { a.href = payUrl; a.hidden = false; });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Sticky nav: frosted glass on scroll ---------- */
  var nav = document.querySelector("[data-nav]");
  var heroImg = document.querySelector("[data-parallax]");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 24);
    // Gentle hero parallax (only while the hero is on screen)
    if (heroImg && !reduceMotion && y < window.innerHeight * 1.2) {
      heroImg.style.transform = "translate3d(0," + (y * 0.18).toFixed(1) + "px,0)";
    }
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-menu]");

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".sr-only").textContent = open ? "Close menu" : "Open menu";
    menu.hidden = !open;
    nav.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
  }
  toggle.addEventListener("click", function () { setMenu(menu.hidden); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a, [data-account-btn]")) setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia("(min-width: 960px)").addEventListener("change", function (mq) {
    if (mq.matches && !menu.hidden) setMenu(false);
  });

  /* ---------- Active nav link ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("[data-navlink]"));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); }).filter(Boolean);
  if ("IntersectionObserver" in window) {
    var activeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          var on = a.getAttribute("href") === "#" + entry.target.id;
          a.classList.toggle("is-active", on);
          if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { activeIO.observe(s); });
  }

  /* ---------- Scroll reveals ---------- */
  var reveals = document.querySelectorAll(".reveal, .feature");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var show = function (el) { el.classList.add("is-visible"); io.unobserve(el); };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) show(entry.target); });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
    // A fast scroll or anchor jump can skip past small elements entirely; reveal anything above the fold.
    var sweep = function () {
      document.querySelectorAll(".reveal:not(.is-visible), .feature:not(.is-visible)").forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) show(el);
      });
    };
    var sweepTimer;
    window.addEventListener("scroll", function () {
      window.clearTimeout(sweepTimer);
      sweepTimer = window.setTimeout(sweep, 120);
    }, { passive: true });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Map: load the embed only when it nears the viewport ---------- */
  var mapFrame = document.querySelector("[data-map] iframe");
  if (mapFrame) {
    var loadMap = function () { if (!mapFrame.src) mapFrame.src = mapFrame.getAttribute("data-src"); };
    if ("IntersectionObserver" in window) {
      var mapIO = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { loadMap(); mapIO.disconnect(); }
      }, { rootMargin: "400px" });
      mapIO.observe(mapFrame);
    } else { loadMap(); }
  }

  /* ---------- Plan buttons preselect the enquiry purpose ---------- */
  document.querySelectorAll("[data-plan]").forEach(function (a) {
    a.addEventListener("click", function () {
      var sel = document.getElementById("f-purpose");
      if (!sel) return;
      sel.value = /personal/i.test(a.getAttribute("data-plan")) ? "Personal training" : "Membership & pricing";
      sel.dispatchEvent(new Event("change"));
    });
  });

  /* Scroll an element to just below the fixed nav. Uses layout position (offsetTop), so an
     element mid reveal-animation (translateY) still lands in the right place. */
  function scrollToEl(el) {
    var y = 0, n = el;
    while (n) { y += n.offsetTop; n = n.offsetParent; }
    var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    window.scrollTo({ top: Math.max(0, y - pad), behavior: reduceMotion ? "auto" : "smooth" });
  }
  window.MHScrollTo = scrollToEl;

  /* ---------- "Enquire now" links: phones jump straight to the form, desktops focus its first field ---------- */
  var stacked = window.matchMedia("(max-width: 979px)"); // .enquire__grid is one column below 980px
  document.querySelectorAll('a[href="#enquire"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var formEl = document.getElementById("enquiry-form");
      if (stacked.matches && formEl) {
        e.preventDefault();
        // Let an open mobile menu close first so the scroll position is right
        window.setTimeout(function () {
          scrollToEl(formEl);
          history.replaceState(null, "", "#enquire");
        }, 50);
        return;
      }
      window.setTimeout(function () {
        var f = document.getElementById("f-name");
        if (f) f.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 600);
    });
  });

  /* ---------- Enquiry form ---------- */
  var form = document.querySelector("[data-form]");
  if (!form) return;
  var status = form.querySelector("[data-status]");
  var purpose = form.elements.purpose, otherField = form.querySelector("[data-other]");

  // "Others" reveals a box to type the purpose
  function syncOther() {
    var on = purpose.value === "Others";
    otherField.hidden = !on;
    form.elements.other.required = on;
    if (!on) { form.elements.other.value = ""; otherField.classList.remove("has-error"); otherField.querySelector(".field__error").textContent = ""; }
  }
  purpose.addEventListener("change", function () {
    syncOther();
    if (purpose.value === "Others") form.elements.other.focus();
  });

  function normalisePhone(raw) {
    var digits = raw.replace(/[\s\-().]/g, "");
    var m = digits.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
    return m ? m[1] : null;
  }

  var rules = {
    name: function (v) {
      v = v.trim();
      if (!v) return "Please enter your full name.";
      if (v.length < 2) return "Name should be at least 2 characters.";
      if (!/\p{L}/u.test(v) || /[<>{}]/.test(v)) return "Please enter your real name.";
      return "";
    },
    phone: function (v) {
      if (!v.trim()) return "Please enter your phone number.";
      if (!normalisePhone(v)) return "Enter a valid 10-digit Indian mobile number, e.g. 98765 43210.";
      return "";
    },
    purpose: function (v) { return v ? "" : "Please choose a purpose."; },
    other: function (v) {
      if (purpose.value !== "Others") return "";
      v = v.trim();
      if (!v) return "Please enter your purpose.";
      if (/[<>{}]/.test(v)) return "Please use plain text.";
      return "";
    },
    time: function (v) { return v ? "" : "Please choose a preferred time."; },
    slot: function (v) { return !form.elements.time.value || v ? "" : "Please choose a time slot."; }
  };

  // Preferred time: pick Morning/Afternoon/Evening/Night, then an hourly slot within gym hours
  var SLOTS = { Morning: [6, 12], Afternoon: [12, 16], Evening: [16, 20], Night: [20, 22] };
  function hourLabel(h) { return (h % 12 || 12) + (h < 12 || h === 24 ? " AM" : " PM"); }
  var timeSel = form.elements.time, slotSel = form.elements.slot, slotField = form.querySelector("[data-slot-field]");
  function fillSlots() {
    var range = SLOTS[timeSel.value];
    slotSel.innerHTML = '<option value="">Select a slot</option>';
    slotField.hidden = !range; slotSel.required = !!range;
    if (!range) return;
    for (var h = range[0]; h < range[1]; h++) {
      var o = document.createElement("option");
      o.textContent = o.value = hourLabel(h) + " – " + hourLabel(h + 1);
      slotSel.appendChild(o);
    }
  }
  timeSel.addEventListener("change", fillSlots);

  function validateField(input) {
    var rule = rules[input.name];
    if (!rule) return true;
    var error = rule(input.value);
    var field = input.closest(".field");
    field.classList.toggle("has-error", !!error);
    input.setAttribute("aria-invalid", error ? "true" : "false");
    field.querySelector(".field__error").textContent = error;
    return !error;
  }

  Object.keys(rules).forEach(function (name) {
    var input = form.elements[name];
    input.addEventListener("blur", function () { if (input.value) validateField(input); });
    input.addEventListener("input", function () {
      if (input.closest(".field").classList.contains("has-error")) validateField(input);
    });
    input.addEventListener("change", function () {
      if (input.tagName === "SELECT") validateField(input);
    });
  });

  function showStatus(type, html) {
    status.hidden = false;
    status.className = "form__status is-" + type;
    status.innerHTML = html;
    status.focus();
  }

  // Logged-in visitors: fill in their name from the account.
  // auth.js loads after this file, so wait until all scripts have run.
  document.addEventListener("DOMContentLoaded", function () {
    if (!(window.MH && window.MH.auth)) return;
    window.MH.auth.onChange(function (u) {
      if (!u) return;
      if (!form.elements.name.value && window.MH.auth.name()) form.elements.name.value = window.MH.auth.name();
    });
  });

  /* ---------- Thank-you after the visitor returns from WhatsApp ---------- */
  var thanks = form.querySelector("[data-thanks]"), pending = null;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function showThanks() {
    var p = pending; pending = null;
    var first = p.name.split(/\s+/)[0];
    thanks.innerHTML =
      '<span class="form__thanks-icon" aria-hidden="true">✓</span>' +
      "<h3>Thank you, " + esc(first) + "!</h3>" +
      "<p>We've received your enquiry. Our team will contact you soon on <strong>+91 " + esc(p.phone.replace(/(\d{5})(\d{5})/, "$1 $2")) + "</strong>" +
      (p.time ? ", in your preferred slot: <strong>" + esc(p.time) + "</strong>" : "") + ".</p>" +
      '<p class="form__thanks-small">Didn\'t press send in WhatsApp? <a href="' + esc(p.url) + '" target="_blank" rel="noopener">Open WhatsApp again</a> or call <a href="tel:+916363342090">063633 42090</a>.</p>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-thanks-reset>Send another enquiry</button>';
    form.classList.add("is-done"); thanks.hidden = false; status.hidden = true;
    thanks.focus({ preventScroll: true });
  }
  function onReturn() {
    if (!pending || document.visibilityState !== "visible") return;
    if (Date.now() - pending.t < 1500) return; // ignore the instant re-focus when WhatsApp didn't take over
    showThanks();
  }
  document.addEventListener("visibilitychange", onReturn);
  window.addEventListener("focus", onReturn);
  thanks.addEventListener("click", function (e) {
    if (!e.target.closest("[data-thanks-reset]")) return;
    form.reset(); syncOther(); fillSlots(); form.classList.remove("is-done"); thanks.hidden = true; status.hidden = true;
    form.elements.name.focus();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = null;
    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name];
      if (!validateField(input) && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      showStatus("error", "<strong>Please check the highlighted fields.</strong>Nothing has been sent yet.");
      firstInvalid.focus();
      return;
    }

    // No login needed to enquire; if the visitor happens to be logged in, mention their account email.
    var auth = window.MH && window.MH.auth;
    var user = auth && auth.user();

    var data = {
      name: form.elements.name.value.trim(),
      phone: normalisePhone(form.elements.phone.value),
      time: form.elements.time.value + ", " + form.elements.slot.value,
      purpose: purpose.value === "Others" ? "Others: " + form.elements.other.value.trim() : purpose.value
    };

    var text =
      "Hi Muscle House! I'd like to enquire about the gym.\n\n" +
      "Name: " + data.name + "\n" +
      "Phone: +91 " + data.phone + "\n" +
      "Purpose: " + data.purpose + "\n" +
      "Preferred time: " + data.time +
      (user && user.email ? "\nAccount email: " + user.email : "");

    var url = "https://wa.me/" + whatsappNumber() + "?text=" + encodeURIComponent(text);
    var win = window.open(url, "_blank");
    if (win) { try { win.opener = null; } catch (err) { /* ignore */ } }

    // Honest status: the enquiry is only delivered once the visitor presses send in WhatsApp.
    // When they come back to the site from WhatsApp, show a thank-you instead of the form.
    if (win) pending = { t: Date.now(), name: data.name, phone: data.phone, time: data.time, url: url };
    if (win) {
      showStatus("success",
        "<strong>WhatsApp should now be open with your enquiry.</strong>" +
        "Your message is <em>not sent yet</em>. Press send in WhatsApp to deliver it to Muscle House. " +
        'If WhatsApp didn\'t open, <a href="' + url + '" target="_blank" rel="noopener">open it here</a> ' +
        'or call <a href="tel:+916363342090">063633 42090</a>.');
    } else {
      showStatus("error",
        "<strong>We couldn't open WhatsApp automatically.</strong>" +
        'Nothing has been sent yet. <a href="' + url + '" target="_blank" rel="noopener">Open WhatsApp with your enquiry</a> ' +
        'or call <a href="tel:+916363342090">063633 42090</a>.');
    }
  });
})();
