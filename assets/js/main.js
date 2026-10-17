/* Muscle House Gym & Fitness Centre — site behaviour */
(function () {
  "use strict";

  // Business contact used by the enquiry hand-off. Change here if the number changes.
  var WHATSAPP_NUMBER = "916363342090"; // country code + number, digits only

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
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

  /* ---------- "Enquire now" links focus the first form field ---------- */
  document.querySelectorAll('a[href="#enquire"]').forEach(function (a) {
    a.addEventListener("click", function () {
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
  var msg = form.querySelector("#f-msg");
  var counter = form.querySelector("[data-count]");

  msg.addEventListener("input", function () { counter.textContent = String(msg.value.length); });

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
      if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(v)) return "Please use letters only.";
      return "";
    },
    phone: function (v) {
      if (!v.trim()) return "Please enter your phone number.";
      if (!normalisePhone(v)) return "Enter a valid 10-digit Indian mobile number, e.g. 98765 43210.";
      return "";
    },
    goal: function (v) { return v ? "" : "Please choose a fitness goal."; },
    time: function (v) { return v ? "" : "Please choose a preferred contact time."; }
  };

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

    var data = {
      name: form.elements.name.value.trim(),
      phone: normalisePhone(form.elements.phone.value),
      goal: form.elements.goal.value,
      time: form.elements.time.value,
      message: msg.value.trim()
    };

    var text =
      "Hi Muscle House! I'd like to enquire about the gym.\n\n" +
      "Name: " + data.name + "\n" +
      "Phone: +91 " + data.phone + "\n" +
      "Fitness goal: " + data.goal + "\n" +
      "Preferred contact time: " + data.time +
      (data.message ? "\nMessage: " + data.message : "");

    var url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
    var win = window.open(url, "_blank");
    if (win) { try { win.opener = null; } catch (err) { /* ignore */ } }

    // Honest status: the enquiry is only delivered once the visitor presses send in WhatsApp.
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
