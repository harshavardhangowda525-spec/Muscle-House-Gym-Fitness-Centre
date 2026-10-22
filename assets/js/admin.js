/* Muscle House — admin dashboard.
 * Auth and data via Supabase; access is enforced by row-level security
 * (supabase/schema.sql), so this page only shows what the database allows. */
(function () {
  "use strict";
  var MH = window.MH;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function show(view) {
    $$("[data-view]").forEach(function (el) { el.hidden = el.getAttribute("data-view") !== view; });
  }

  if (!MH.isConfigured() || !window.supabase) { show("setup"); return; }

  var db = window.supabase.createClient(MH.cfg.supabaseUrl, MH.cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  var state = { members: [], plans: [], settings: null, filter: null, search: "", user: null };

  /* ---------- Helpers ---------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function istToday() {
    // YYYY-MM-DD in India time
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: d.length === 10 ? undefined : "Asia/Kolkata" });
  }
  function toast(msg, isError) {
    var t = $("[data-toast]");
    t.textContent = msg; t.hidden = false;
    t.classList.toggle("is-error", !!isError);
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () { t.hidden = true; }, 3500);
  }
  function fail(err) { toast(err && err.message ? err.message : "Something went wrong", true); }

  /* Derived status: pending | active | expiring | expired | rejected */
  function bucket(m, today) {
    if (m.status === "pending") return "pending";
    if (m.status === "rejected") return "rejected";
    if (!m.end_date || m.end_date < today) return "expired";
    return daysBetween(today, m.end_date) <= 7 ? "expiring" : "active";
  }

  /* ---------- Auth ---------- */
  function boot(session) {
    if (!session) { show("login"); return; }
    state.user = session.user;
    $$("[data-user-email]").forEach(function (el) { el.textContent = session.user.email || ""; });
    db.rpc("is_admin").then(function (res) {
      if (res.error) throw res.error;
      if (res.data !== true) { show("denied"); return; }
      show("app");
      loadAll();
    }).catch(function (err) { show("login"); showLoginError(err.message); });
  }

  function showLoginError(msg) {
    var box = $("[data-login-error]");
    box.textContent = msg; box.hidden = !msg;
  }

  $("[data-login]").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("#a-email").value.trim(), password = $("#a-password").value;
    if (!email || !password) { showLoginError("Enter your email and password."); return; }
    var btn = $("[data-login-submit]");
    btn.disabled = true; btn.textContent = "Signing in…"; showLoginError("");
    db.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      $("#a-password").value = "";
      boot(res.data.session);
    }).catch(function (err) {
      var msg = err.message || "";
      showLoginError(
        /invalid login credentials/i.test(msg) ? "Incorrect email or password." :
        /email not confirmed/i.test(msg) ? "This account isn't confirmed yet. In Supabase → Authentication → Users, open the user and confirm them (or re-create them with Auto Confirm User ticked)." :
        /invalid api key|no api key/i.test(msg) ? "The Supabase key in assets/js/config.js is wrong. Use the anon public key (starts with eyJ)." :
        /failed to fetch|network/i.test(msg) ? "Couldn't reach Supabase. Check the Project URL in assets/js/config.js." :
        "Sign-in failed: " + msg);
    }).then(function () { btn.disabled = false; btn.textContent = "Sign in"; });
  });

  $$("[data-signout]").forEach(function (b) {
    b.addEventListener("click", function () {
      db.auth.signOut().then(function () { state.members = []; show("login"); });
    });
  });

  db.auth.getSession().then(function (res) { boot(res.data.session); });

  /* ---------- Tabs ---------- */
  var tabs = $$("[data-tab]");
  function selectTab(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t.getAttribute("data-tab")); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      var next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus(); next.click();
    });
  });

  /* ---------- Data ---------- */
  function loadAll() {
    return Promise.all([
      db.from("memberships").select("*").order("created_at", { ascending: false }).limit(5000),
      db.from("plans").select("*").order("sort", { ascending: true }),
      db.from("settings").select("*").eq("id", 1).maybeSingle()
    ]).then(function (r) {
      r.forEach(function (x) { if (x.error) throw x.error; });
      state.members = r[0].data;
      state.plans = r[1].data;
      state.settings = r[2].data;
      if (!state.filter) state.filter = state.members.some(function (m) { return m.status === "pending"; }) ? "pending" : "active";
      renderMembers(); renderSettings(); renderPlans();
    }).catch(fail);
  }

  function reloadMembers() {
    return db.from("memberships").select("*").order("created_at", { ascending: false }).limit(5000).then(function (r) {
      if (r.error) throw r.error;
      state.members = r.data; renderMembers();
    });
  }

  // Keep the list fresh while the page is open.
  window.setInterval(function () {
    if (!document.hidden && !$("[data-view=app]").hidden && !$("[data-panel=members]").hidden && !$("dialog[open]")) reloadMembers().catch(function () {});
  }, 60000);

  /* ---------- Members ---------- */
  function renderMembers() {
    var today = istToday();
    var counts = { pending: 0, active: 0, expiring: 0, expired: 0, rejected: 0, all: state.members.length };
    var month = today.slice(0, 7), revenue = 0;
    state.members.forEach(function (m) {
      m._bucket = bucket(m, today);
      counts[m._bucket]++;
      if (m._bucket === "expiring") counts.active++;
      if (m.status === "verified" && m.reviewed_at &&
          new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date(m.reviewed_at)) === month) {
        revenue += m.amount;
      }
    });
    Object.keys(counts).forEach(function (k) {
      var el = $('[data-count="' + k + '"]'); if (el) el.textContent = counts[k];
    });
    $('[data-stat="active"]').textContent = counts.active;
    $('[data-stat="pending"]').textContent = counts.pending;
    $('[data-stat="expiring"]').textContent = counts.expiring;
    $('[data-stat="revenue"]').textContent = MH.inr(revenue);

    $$("[data-filter]").forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-filter") === state.filter)); });

    var q = state.search.toLowerCase();
    var rows = state.members.filter(function (m) {
      var f = state.filter;
      var inFilter = f === "all" || m._bucket === f || (f === "active" && m._bucket === "expiring");
      if (!inFilter) return false;
      if (!q) return true;
      return (m.full_name + " " + m.phone + " " + (m.email || "") + " " + (m.upi_ref || "")).toLowerCase().indexOf(q) !== -1;
    });

    $("[data-rows]").innerHTML = rows.map(function (m) { return rowHtml(m, today); }).join("");
    $("[data-empty]").hidden = rows.length > 0;
  }

  var LABEL = { pending: "Pending", active: "Active", expiring: "Expiring soon", expired: "Expired", rejected: "Rejected" };

  function rowHtml(m, today) {
    var membership = "—";
    if (m.status === "verified") {
      var left = daysBetween(today, m.end_date);
      membership = fmtDate(m.start_date) + " → " + fmtDate(m.end_date) +
        '<span class="sub">' + (left >= 0 ? left + (left === 1 ? " day" : " days") + " left" : "Ended " + (-left) + " days ago") + "</span>";
    }
    var actions = [];
    if (m.status === "pending") {
      actions.push('<button class="btn btn--accent btn--xs" data-act="verify">Verify</button>');
      actions.push('<button class="btn btn--ghost btn--xs" data-act="reject">Reject</button>');
    } else {
      actions.push('<button class="btn btn--ghost btn--xs" data-act="pending" title="Move back to pending">Undo</button>');
    }
    actions.push('<button class="iconbtn" data-act="delete" aria-label="Delete record" title="Delete">✕</button>');

    return '<tr data-id="' + esc(m.id) + '">' +
      '<td data-label="Member"><strong>' + esc(m.full_name) + '</strong><a class="sub" href="tel:+91' + esc(m.phone) + '">+91 ' + esc(m.phone) + "</a>" +
        (m.email ? '<span class="sub">' + esc(m.email) + "</span>" : "") + "</td>" +
      '<td data-label="Plan">' + esc(m.plan_name) + '<span class="sub">' + MH.inr(m.amount) + "</span></td>" +
      '<td data-label="Payment">' + esc(m.payment_method.toUpperCase()) + '<span class="sub mono">' + esc(m.upi_ref || "—") + "</span></td>" +
      '<td data-label="Submitted">' + fmtDate(m.created_at) + "</td>" +
      '<td data-label="Status"><span class="badge badge--' + m._bucket + '">' + LABEL[m._bucket] + "</span>" +
        (m.admin_note ? '<span class="sub">' + esc(m.admin_note) + "</span>" : "") + "</td>" +
      '<td data-label="Membership">' + membership + "</td>" +
      '<td class="actions">' + actions.join("") + "</td>" +
    "</tr>";
  }

  $$("[data-filter]").forEach(function (c) {
    c.addEventListener("click", function () { state.filter = c.getAttribute("data-filter"); renderMembers(); });
  });
  $$("[data-filter-shortcut]").forEach(function (c) {
    c.addEventListener("click", function () { state.filter = c.getAttribute("data-filter-shortcut"); renderMembers(); });
  });
  $("[data-search]").addEventListener("input", function (e) { state.search = e.target.value.trim(); renderMembers(); });
  $("[data-refresh]").addEventListener("click", function () { reloadMembers().then(function () { toast("Updated"); }, fail); });

  /* Dialog helper: resolves with "ok" or "cancel" */
  function ask(name, setup) {
    var dlg = $('[data-dialog="' + name + '"]');
    if (setup) setup(dlg);
    dlg.returnValue = "";
    dlg.showModal();
    return new Promise(function (resolve) {
      dlg.addEventListener("close", function onClose() {
        dlg.removeEventListener("close", onClose);
        resolve(dlg.returnValue === "ok" ? dlg : null);
      });
    });
  }

  function summary(m) {
    return "<strong>" + esc(m.full_name) + "</strong> · " + esc(m.plan_name) + " · " + MH.inr(m.amount) +
      (m.upi_ref ? '<br>UPI ref <span class="mono">' + esc(m.upi_ref) + "</span>" : "");
  }

  function update(id, patch, okMsg) {
    return db.from("memberships").update(patch).eq("id", id).then(function (r) {
      if (r.error) throw r.error;
      toast(okMsg);
      return reloadMembers();
    }).catch(fail);
  }

  $("[data-rows]").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.closest("tr").getAttribute("data-id");
    var m = state.members.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var act = btn.getAttribute("data-act");

    if (act === "verify") {
      ask("verify", function (d) {
        $("[data-verify-summary]", d).innerHTML = summary(m);
        $("#dv-start").value = istToday();
        $("#dv-note").value = m.admin_note || "";
      }).then(function (d) {
        if (!d) return;
        update(id, { status: "verified", start_date: $("#dv-start").value || istToday(), admin_note: $("#dv-note").value.trim() || null },
          m.full_name + " is now active");
      });
    } else if (act === "reject") {
      ask("reject", function (d) {
        $("[data-reject-summary]", d).innerHTML = summary(m);
        $("#dr-note").value = "";
      }).then(function (d) {
        if (!d) return;
        update(id, { status: "rejected", admin_note: $("#dr-note").value.trim() || null }, "Request rejected");
      });
    } else if (act === "pending") {
      update(id, { status: "pending" }, "Moved back to pending");
    } else if (act === "delete") {
      ask("delete", function (d) { $("[data-delete-summary]", d).innerHTML = summary(m); }).then(function (d) {
        if (!d) return;
        db.from("memberships").delete().eq("id", id).then(function (r) {
          if (r.error) throw r.error;
          toast("Record deleted"); return reloadMembers();
        }).catch(fail);
      });
    }
  });

  /* Add walk-in / cash member */
  var addForm = $("[data-add-form]");
  $("[data-add]").addEventListener("click", function () {
    addForm.reset();
    $("[data-add-error]").hidden = true;
    $("[data-add-plans]").innerHTML = state.plans.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.name) + " · " + MH.inr(p.price) + "</option>";
    }).join("");
    $("#da-start").value = istToday();
    $('[data-dialog="add"]').showModal();
    $("#da-name").focus();
  });
  addForm.addEventListener("submit", function (e) {
    if (!e.submitter || e.submitter.value !== "ok") return; // Cancel closes normally
    e.preventDefault();
    var err = $("[data-add-error]");
    var name = $("#da-name").value.trim();
    var phone = $("#da-phone").value.replace(/[\s\-().]/g, "").replace(/^(?:\+?91|0)(?=[6-9]\d{9}$)/, "");
    var method = $("#da-method").value;
    var ref = $("#da-ref").value.replace(/[\s-]/g, "").toUpperCase();
    var email = $("#da-email").value.trim().toLowerCase();
    var problem =
      name.length < 2 ? "Enter the member's full name." :
      !/^[6-9]\d{9}$/.test(phone) ? "Enter a valid 10-digit mobile number." :
      email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? "Enter a valid email address, or leave it empty." :
      method === "upi" && !/^[A-Z0-9]{6,35}$/.test(ref) ? "Enter the UPI reference for a UPI payment." :
      ref && !/^[A-Z0-9]{6,35}$/.test(ref) ? "The reference should be 6–35 letters or numbers." : "";
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    err.hidden = true;
    db.from("memberships").insert({
      full_name: name, phone: phone, plan_id: $("#da-plan").value, payment_method: method,
      email: email || null, // the database links the membership to this member's login, if they have one
      upi_ref: ref || null, status: "verified", start_date: $("#da-start").value || istToday()
    }).then(function (r) {
      if (r.error) throw r.error;
      $('[data-dialog="add"]').close();
      toast(name + " added" + (email ? ". They'll see it under My membership if " + email + " has a website login" : ""));
      state.filter = "active";
      return reloadMembers();
    }).catch(function (e2) {
      err.textContent = e2.code === "23505" ? "That UPI reference is already recorded." : e2.message;
      err.hidden = false;
    });
  });

  /* CSV export of the current view */
  $("[data-export]").addEventListener("click", function () {
    var ids = $$("[data-rows] tr").map(function (tr) { return tr.getAttribute("data-id"); });
    var rows = state.members.filter(function (m) { return ids.indexOf(m.id) !== -1; });
    var cols = ["full_name", "phone", "email", "plan_name", "amount", "payment_method", "upi_ref", "status", "start_date", "end_date", "created_at", "admin_note"];
    var csv = [cols.join(",")].concat(rows.map(function (m) {
      return cols.map(function (c) {
        var v = m[c] == null ? "" : String(m[c]);
        if (/^[=+\-@]/.test(v)) v = "'" + v; // avoid spreadsheet formula injection
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(",");
    })).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "muscle-house-members-" + istToday() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---------- "Sample prices" notice toggle (Plans & prices tab) ---------- */
  var sForm = $("[data-settings]");
  var sStatus = $("[data-settings-status]");

  function renderSettings() {
    sForm.show_sample_notice.checked = !state.settings || state.settings.show_sample_notice !== false;
  }
  sForm.show_sample_notice.addEventListener("change", function () {
    var on = sForm.show_sample_notice.checked;
    sStatus.textContent = "Saving…";
    db.from("settings").update({ show_sample_notice: on }).eq("id", 1).select().maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      state.settings = r.data;
      sStatus.textContent = on ? "Notice shown on the website." : "Notice hidden on the website.";
    }).catch(function (err) {
      sForm.show_sample_notice.checked = !on;
      sStatus.textContent = "";
      fail(err);
    });
  });

  /* ---------- Plans ---------- */
  function renderPlans() {
    $("[data-plan-rows]").innerHTML = state.plans.map(function (p) {
      return '<tr data-plan="' + esc(p.id) + '">' +
        '<td data-label="Plan"><strong>' + esc(p.name) + "</strong></td>" +
        '<td data-label="Length">' + p.months + (p.months === 1 ? " month" : " months") + "</td>" +
        '<td data-label="Price (₹)"><input class="price-input" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="' + p.price + '" aria-label="Price for ' + esc(p.name) + '"></td>' +
        '<td data-label="Shown on website"><label class="switch"><input type="checkbox"' + (p.active ? " checked" : "") + ' aria-label="Show ' + esc(p.name) + ' on website"><span></span></label></td>' +
        '<td class="actions"><button class="btn btn--ghost btn--xs" data-save-plan>Save</button></td>' +
      "</tr>";
    }).join("");
  }
  $("[data-plan-rows]").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-save-plan]");
    if (!btn) return;
    var tr = btn.closest("tr");
    var price = parseInt($(".price-input", tr).value, 10);
    if (!(price >= 1 && price <= 1000000)) { toast("Enter a price between ₹1 and ₹10,00,000", true); return; }
    db.from("plans").update({ price: price, active: $('input[type="checkbox"]', tr).checked })
      .eq("id", tr.getAttribute("data-plan")).select().maybeSingle().then(function (r) {
        if (r.error) throw r.error;
        state.plans = state.plans.map(function (p) { return p.id === r.data.id ? r.data : p; });
        toast(r.data.name + " plan saved");
      }).catch(fail);
  });
})();
