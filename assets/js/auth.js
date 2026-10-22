/* Muscle House — member accounts (Supabase Auth).
 * Log in / sign up with email + password or Google, password reset,
 * and the "My membership" panel. Exposes MH.db and MH.auth for join.js. */
(function () {
  "use strict";
  var MH = window.MH;
  if (!MH || !MH.isConfigured() || !window.supabase) return;

  var db = window.supabase.createClient(MH.cfg.supabaseUrl, MH.cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  MH.db = db;

  var user = null, ready = false, listeners = [], afterLogin = null;
  var siteUrl = location.origin + location.pathname;

  function displayName(u) {
    var m = (u && u.user_metadata) || {};
    return (m.full_name || m.name || "").trim();
  }
  function emit() { listeners.forEach(function (fn) { fn(user); }); }

  MH.auth = {
    user: function () { return user; },
    name: function () { return displayName(user); },
    onChange: function (fn) { listeners.push(fn); if (ready) fn(user); },
    /* Ask the visitor to log in, then run `then` (or redirect back with ?join=plan for Google). */
    require: function (opts) {
      if (user) { opts.then(); return; }
      afterLogin = opts;
      openAuth("login", opts.reason);
    },
    signOut: function () { return db.auth.signOut(); }
  };

  /* ---------- Session ---------- */
  db.auth.onAuthStateChange(function (event, session) {
    user = session ? session.user : null;
    ready = true;
    updateNav();
    emit();
    if (event === "PASSWORD_RECOVERY") openAuth("reset");
  });

  // Errors returned by Google/Supabase in the redirect URL
  (function () {
    var params = new URLSearchParams(location.hash.replace(/^#/, "") || location.search);
    var err = params.get("error_description");
    if (err) {
      window.setTimeout(function () { openAuth("login"); status("error", "Sign-in didn't complete: " + err.replace(/\+/g, " ")); }, 300);
      history.replaceState(null, "", siteUrl);
    }
  })();

  /* ---------- Nav button ---------- */
  var navBtns = document.querySelectorAll("[data-account-btn]");
  function updateNav() {
    navBtns.forEach(function (b) {
      b.hidden = false;
      var label = b.querySelector("[data-account-label]");
      if (user) {
        var first = (displayName(user) || user.email || "").split(/[\s@]/)[0];
        label.textContent = b.hasAttribute("data-account-long") ? "My membership" : (first || "Account");
        b.setAttribute("aria-label", "My membership" + (user.email ? " (" + user.email + ")" : ""));
      } else {
        label.textContent = "Log in";
        b.setAttribute("aria-label", "Log in or create an account");
      }
    });
  }
  navBtns.forEach(function (b) {
    b.addEventListener("click", function () { if (user) openAccount(); else openAuth("login"); });
  });

  /* ---------- Auth dialog ---------- */
  var dlg = document.getElementById("auth-dialog");
  var $ = function (sel) { return dlg.querySelector(sel); };
  var TITLES = { login: "Log in", signup: "Create account", forgot: "Reset password", reset: "Set a new password" };

  function mode(m) {
    dlg.querySelectorAll("[data-a-form]").forEach(function (f) { f.hidden = f.getAttribute("data-a-form") !== m; });
    dlg.querySelectorAll("[data-a-tab]").forEach(function (t) { t.setAttribute("aria-selected", String(t.getAttribute("data-a-tab") === m)); });
    $("[data-a-tabs]").hidden = !(m === "login" || m === "signup");
    $("[data-a-social]").hidden = !(m === "login" || m === "signup");
    $("[data-a-title]").textContent = TITLES[m];
    status();
    window.setTimeout(function () {
      var first = dlg.querySelector('[data-a-form="' + m + '"] input');
      if (first) first.focus();
    }, 30);
  }
  function openAuth(m, reason) {
    $("[data-a-reason]").textContent = reason || "Log in to join a plan and see your membership.";
    mode(m);
    if (!dlg.open) dlg.showModal();
  }
  function closeAuth() { if (dlg.open) dlg.close(); }
  dlg.addEventListener("close", function () { if (!user) afterLogin = null; });
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg || e.target.closest("[data-a-close]")) closeAuth();
    var t = e.target.closest("[data-a-tab],[data-a-goto]");
    if (t) mode(t.getAttribute("data-a-tab") || t.getAttribute("data-a-goto"));
  });

  function status(type, msg) {
    var box = $("[data-a-status]");
    if (!type) { box.hidden = true; return; }
    box.className = "form__status is-" + type;
    box.textContent = msg;
    box.hidden = false;
  }
  function busy(form, on, label) {
    var b = form.querySelector('button[type="submit"]');
    if (on) { b.dataset.label = b.textContent; b.textContent = label; } else if (b.dataset.label) b.textContent = b.dataset.label;
    b.disabled = on;
  }
  function friendly(err) {
    var m = (err && err.message) || "";
    if (/invalid login credentials/i.test(m)) return "Incorrect email or password.";
    if (/already registered|already exists/i.test(m)) return "An account with this email already exists. Log in instead.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for the link.";
    if (/password should be|weak/i.test(m)) return "Choose a stronger password (at least 8 characters).";
    if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/signups? not allowed|signup is disabled/i.test(m)) return "New sign-ups are currently turned off. Please contact the gym.";
    if (/provider is not enabled/i.test(m)) return "Google sign-in isn't switched on yet. Please use email for now.";
    if (/failed to fetch|network/i.test(m)) return "Couldn't connect. Check your internet and try again.";
    return m || "Something went wrong. Please try again.";
  }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function loggedIn() {
    closeAuth();
    var next = afterLogin; afterLogin = null;
    if (next && next.then) next.then();
  }

  $('[data-a-form="login"]').addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.currentTarget, email = f.email.value.trim(), pw = f.password.value;
    if (!EMAIL.test(email) || !pw) { status("error", "Enter your email and password."); return; }
    busy(f, true, "Logging in…"); status();
    db.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
      if (r.error) throw r.error;
      f.reset(); user = r.data.user; loggedIn();
    }).catch(function (err) { status("error", friendly(err)); }).then(function () { busy(f, false); });
  });

  $('[data-a-form="signup"]').addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.currentTarget, name = f.full_name.value.trim(), email = f.email.value.trim(), pw = f.password.value;
    var problem = name.length < 2 ? "Enter your full name." : !EMAIL.test(email) ? "Enter a valid email address." :
      pw.length < 8 ? "Password must be at least 8 characters." : "";
    if (problem) { status("error", problem); return; }
    busy(f, true, "Creating account…"); status();
    db.auth.signUp({ email: email, password: pw, options: { data: { full_name: name }, emailRedirectTo: siteUrl } }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0) throw new Error("already registered");
      f.reset();
      if (r.data.session) { user = r.data.user; loggedIn(); }
      else { mode("login"); status("success", "Check " + email + " for a confirmation link, then log in here."); }
    }).catch(function (err) { status("error", friendly(err)); }).then(function () { busy(f, false); });
  });

  $('[data-a-form="forgot"]').addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.currentTarget, email = f.email.value.trim();
    if (!EMAIL.test(email)) { status("error", "Enter the email you signed up with."); return; }
    busy(f, true, "Sending…"); status();
    db.auth.resetPasswordForEmail(email, { redirectTo: siteUrl }).then(function (r) {
      if (r.error) throw r.error;
      status("success", "If an account exists for " + email + ", a reset link is on its way. It can take a few minutes.");
    }).catch(function (err) { status("error", friendly(err)); }).then(function () { busy(f, false); });
  });

  $('[data-a-form="reset"]').addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.currentTarget, pw = f.password.value;
    if (pw.length < 8) { status("error", "Password must be at least 8 characters."); return; }
    busy(f, true, "Saving…");
    db.auth.updateUser({ password: pw }).then(function (r) {
      if (r.error) throw r.error;
      f.reset(); status("success", "Password updated. You're logged in.");
      window.setTimeout(closeAuth, 1200);
      history.replaceState(null, "", siteUrl);
    }).catch(function (err) { status("error", friendly(err)); }).then(function () { busy(f, false); });
  });

  $("[data-a-google]").addEventListener("click", function () {
    var plan = afterLogin && afterLogin.plan;
    status();
    db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: siteUrl + (plan ? "?join=" + encodeURIComponent(plan) : ""),
        // Always show Google's account chooser instead of silently reusing the last account
        queryParams: { prompt: "select_account" }
      }
    }).then(function (r) { if (r.error) status("error", friendly(r.error)); });
  });

  /* ---------- My membership ---------- */
  var acc = document.getElementById("account-dialog");
  var A = function (sel) { return acc.querySelector(sel); };
  var LABEL = { pending: "Pending verification", active: "Active", expired: "Expired", rejected: "Not approved" };

  function istToday() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function fmt(d) { return d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function openAccount() {
    A("[data-acc-name]").textContent = displayName(user) || "My membership";
    A("[data-acc-email]").textContent = user.email || "";
    A("[data-acc-list]").innerHTML = '<p class="acc__empty">Loading…</p>';
    acc.showModal();
    loadAccount();
  }
  MH.auth.openAccount = function () { if (user) openAccount(); };

  function loadAccount() {
    db.from("memberships")
      .select("id,created_at,plan_name,amount,status,start_date,end_date,upi_ref,payment_method")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        var today = istToday();
        A("[data-acc-list]").innerHTML = r.data.length ? r.data.map(function (m) {
          var b = m.status === "pending" ? "pending" : m.status === "rejected" ? "rejected" : (m.end_date >= today ? "active" : "expired");
          var detail =
            b === "pending" ? "Submitted " + new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ". The gym will verify your payment soon." :
            b === "active" ? "Active " + fmt(m.start_date) + " → " + fmt(m.end_date) :
            b === "expired" ? "Ended " + fmt(m.end_date) :
            "This payment couldn't be verified. Please contact the gym.";
          return '<li class="acc__item"><div class="acc__top"><strong>' + esc(m.plan_name) + "</strong><span>" + MH.inr(m.amount) + '</span></div>' +
            '<span class="badge badge--' + b + '">' + LABEL[b] + "</span>" +
            '<p class="acc__detail">' + esc(detail) + "</p>" +
            (m.upi_ref ? '<p class="acc__ref">UPI ref ' + esc(m.upi_ref) + "</p>" : "") + "</li>";
        }).join("") : '<p class="acc__empty">No memberships yet. Choose a plan to get started.</p>';
      }).catch(function (err) {
        var outdated = err && (err.code === "42703" || /user_id/.test(err.message || ""));
        A("[data-acc-list]").innerHTML = '<p class="acc__empty">' + (outdated
          ? "Membership history isn't available yet. The gym's database needs the latest update (supabase/schema.sql)."
          : "Couldn't load your membership right now. Please try again.") + "</p>";
      });
  }

  acc.addEventListener("click", function (e) {
    if (e.target === acc || e.target.closest("[data-acc-close]")) acc.close();
    if (e.target.closest("[data-acc-plans]")) { acc.close(); location.hash = "#membership"; }
    if (e.target.closest("[data-acc-logout]")) {
      db.auth.signOut().then(function () { acc.close(); });
    }
  });
})();
