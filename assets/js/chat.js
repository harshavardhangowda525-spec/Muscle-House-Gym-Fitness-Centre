/* Muscle House — on-site help assistant.
 *
 * A rule-based FAQ assistant that runs entirely in the visitor's browser:
 * no AI service, no API key, no cost. Typed questions are matched to the
 * topics below by keywords and phrases, tolerating plurals and small typos.
 * Answers use only verified gym facts and live information from the page
 * (current plan prices, whether online joining is available, login state).
 * Anything it can't answer is handed to the gym on WhatsApp.
 */
(function () {
  "use strict";

  /* ---------- Verified facts ---------- */
  var GYM = {
    name: "Muscle House Gym & Fitness Centre",
    address: "Indian Coffee House Building, 3rd Floor, 754, 19th Main, 22nd Cross Road, Sector 2, HSR Layout, Bengaluru, Karnataka 560102",
    phoneDisplay: "063633 42090",
    phoneTel: "tel:+916363342090",
    closing: "10:00 PM",
    rating: "4.4/5",
    reviews: "105",
    directions: "https://www.google.com/maps/dir/?api=1&destination=Muscle%20House%20Gym%20%26%20Fitness%20Centre%2C%20754%2C%2019th%20Main%2C%2022nd%20Cross%20Road%2C%20Sector%202%2C%20HSR%20Layout%2C%20Bengaluru%2C%20Karnataka%20560102",
    reviewsUrl: "https://www.google.com/maps/search/?api=1&query=Muscle%20House%20Gym%20%26%20Fitness%20Centre%2C%20754%2C%2019th%20Main%2C%2022nd%20Cross%20Road%2C%20Sector%202%2C%20HSR%20Layout%2C%20Bengaluru%20560102"
  };

  function waNumber() {
    var cfg = (window.MH && window.MH.cfg) || window.MH_CONFIG || {};
    return String(cfg.whatsappNumber || "916363342090").replace(/\D/g, "");
  }
  function waLink(text) { return "https://wa.me/" + waNumber() + "?text=" + encodeURIComponent(text); }

  /* ---------- Live page context ---------- */
  function visible(el) { return !!el && !el.hidden && el.offsetParent !== null; }
  function livePlans() {
    var out = [];
    document.querySelectorAll("[data-plan-id]").forEach(function (card) {
      if (card.hidden) return;
      var name = card.querySelector("[data-name]"), price = card.querySelector("[data-price]"),
          period = card.querySelector("[data-period]"), per = card.querySelector("[data-per]");
      out.push({
        id: card.getAttribute("data-plan-id"),
        name: name ? name.textContent.trim() : "",
        price: price ? price.textContent.trim() : "",
        period: period ? period.textContent.replace("/", "").trim() : "",
        per: per ? per.textContent.trim() : "",
        best: card.classList.contains("plan--featured")
      });
    });
    return out;
  }
  // Plan cards can be hidden by the gym (membership by phone only)
  function plansHidden() { var w = document.querySelector("[data-plans]"); return !!w && w.hidden; }
  function byPhone(intro) {
    return { text: [intro, "📞 Call **" + GYM.phoneDisplay + "** and the team will walk you through the membership options and pricing, and help you pick the right plan for your goal."],
      actions: [{ label: "Call " + GYM.phoneDisplay, href: GYM.phoneTel, kind: "primary" }, { label: "WhatsApp us", href: waLink("Hi Muscle House! I'd like to know about your membership plans."), kind: "wa" }],
      chips: ["Where is the gym?", "Gym timings", "Personal training"] };
  }
  function sampleNotice() { var n = document.querySelector("[data-sample-notice]"); return !!n && !n.hidden; }
  function canJoinOnline() { return !plansHidden() && Array.prototype.some.call(document.querySelectorAll("[data-join]"), function (b) { return !b.hidden; }); }
  function currentUser() { return window.MH && window.MH.auth ? window.MH.auth.user() : null; }

  /* ---------- Text matching ---------- */
  function normalize(s) {
    return String(s).toLowerCase()
      .replace(/[₹]/g, " rupees ")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9ऀ-ॿಀ-೿\s]/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function stem(w) { return w.length > 4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w; }
  // Optimal string alignment distance (counts a swapped pair of letters as one edit)
  function dist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }
  function tokenHit(tokens, key) {
    var k = stem(key), best = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t === k) return 2;
      if (k.length >= 4 && t.length >= 4 && t[0] === k[0]) { // typos rarely change the first letter
        var limit = k.length >= 8 ? 2 : 1;
        if (dist(t, k) <= limit) best = Math.max(best, 1.2);
      }
    }
    return best;
  }
  function score(text, intent) {
    var norm = " " + text + " ", tokens = text.split(" ").map(stem), s = 0, seen = {};
    intent.keys.forEach(function (key) {
      var w = 1, k = key;
      var m = /^(.*)\^(\d+(?:\.\d+)?)$/.exec(key); // "word^3" = weight
      if (m) { k = m[1]; w = parseFloat(m[2]); }
      if (k.indexOf(" ") !== -1) { if (norm.indexOf(" " + k + " ") !== -1) s += 3 * w; return; }
      var sk = stem(k);
      if (seen[sk]) return; // "price" and "prices" count once
      var hit = tokenHit(tokens, k);
      if (hit) { seen[sk] = true; s += hit * w; }
    });
    return s;
  }

  /* ---------- Topics ---------- */
  // Facilities we have NOT verified: never claim them, always hand off.
  var UNVERIFIED = {
    parking: "parking", park: "parking", shower: "showers", bath: "showers", locker: "lockers",
    "changing room": "changing rooms", washroom: "washrooms", toilet: "washrooms", ac: "air conditioning",
    "air conditioned": "air conditioning", aircon: "air conditioning", steam: "steam room", sauna: "sauna",
    zumba: "Zumba classes", yoga: "yoga classes", crossfit: "CrossFit", aerobic: "aerobics", class: "group classes",
    diet: "diet plans", nutrition: "diet plans", supplement: "supplements", women: "women-only timings",
    ladies: "women-only timings", female: "women-only timings", couple: "couple memberships", student: "student discounts",
    discount: "discounts", offer: "offers", refund: "refunds", freeze: "membership freezing", pause: "membership freezing",
    transfer: "membership transfer", wifi: "Wi-Fi", water: "drinking water", towel: "towels", kid: "age limits", age: "age limits",
    cardio: "the cardio equipment list", treadmill: "treadmills", cycle: "cycling machines", bike: "cycling machines"
  };
  function unverifiedTerms(text) {
    var found = [], tokens = text.split(" ").map(stem);
    Object.keys(UNVERIFIED).forEach(function (k) {
      var hit = k.indexOf(" ") !== -1 ? (" " + text + " ").indexOf(" " + k + " ") !== -1 : tokens.indexOf(stem(k)) !== -1;
      if (hit && found.indexOf(UNVERIFIED[k]) === -1) found.push(UNVERIFIED[k]);
    });
    return found;
  }

  var CHIPS_START = ["Membership prices", "How do I join?", "Where is the gym?", "Gym timings", "Talk to the gym"];

  var INTENTS = [
    { id: "greet", keys: ["hi", "hii", "hello", "hey", "namaste", "namaskara", "good morning", "good evening", "good afternoon", "hola", "yo"],
      reply: function () { return { text: ["Hi! 👋 I'm the Muscle House assistant. I can help with **membership plans**, **how to join**, **location and timings**, your **account**, and how this website works.", "What would you like to know?"], chips: CHIPS_START }; } },

    { id: "thanks", keys: ["thanks^2", "thank you", "thankyou", "thx", "ty", "dhanyavad", "shukriya", "great", "awesome", "perfect", "ok thanks", "cool"],
      reply: function () { return { text: ["You're welcome! 💪 Anything else I can help with?"], chips: ["Membership prices", "Talk to the gym"] }; } },

    { id: "bye", keys: ["bye^2", "goodbye", "see you", "tata", "later"],
      reply: function () { return { text: ["See you at Muscle House! 🏋️ If you need anything, the gym is on " + "**" + GYM.phoneDisplay + "**."] }; } },

    { id: "plans", keys: ["price^2", "prices^2", "pricing^2", "fee^2", "fees^2", "cost^2", "charge", "charges", "rate", "rates", "plan^1.5", "plans^1.5", "package", "packages",
        "membership", "monthly", "quarterly", "half yearly", "halfyearly", "annual", "yearly", "year", "month", "kitna^2", "kitne", "amount", "how much^2", "subscription", "rupees", "cheapest", "best plan", "best value"],
      reply: function () {
        if (plansHidden()) return byPhone("Membership plans and prices are shared **over the phone**.");
        var plans = livePlans();
        if (!plans.length) return { text: ["Membership details are shown in the **Membership** section. For current prices, please ask the gym."], actions: [{ label: "See plans", action: "scroll:#membership" }, { label: "Ask on WhatsApp", href: waLink("Hi Muscle House! What are your membership prices?"), kind: "wa" }] };
        var best = plans.filter(function (p) { return p.best; })[0];
        var text = ["Here are the membership plans:"];
        var list = plans.map(function (p) {
          return /^month$/i.test(p.period) ? "**" + p.name + "**: ₹" + p.price + " per month"
            : "**" + p.name + "**: ₹" + p.price + " for " + p.period + " (" + p.per.replace(/^≈\s*/, "about ") + ")";
        });
        var after = [];
        if (best) after.push("The **" + best.name + "** plan has the lowest monthly cost.");
        if (sampleNotice()) after.push("_These are sample prices for now. Please confirm the current rates with the gym._");
        return { text: text, list: list, after: after,
          actions: [{ label: "View plans", action: "scroll:#membership" }].concat(canJoinOnline() ? [{ label: "How to join", ask: "How do I join?" }] : [{ label: "Ask on WhatsApp", href: waLink("Hi Muscle House! I'd like to know more about your membership plans."), kind: "wa" }]),
          chips: ["How do I join?", "How do I pay?", "Personal training"] };
      } },

    { id: "join", keys: ["join^2", "joining^2", "how to join^2", "enroll", "enrol", "enrollment", "admission", "become a member", "become member", "buy membership", "take membership", "get membership", "start membership", "get a membership^1.5", "buy a membership^1.5", "take a membership^1.5", "want a membership^1.5", "like to join", "want to join", "subscribe", "register for", "sign up for", "new member"],
      reply: function () {
        if (plansHidden()) return byPhone("Joining is easy: it starts with **one call**.");
        if (!canJoinOnline()) return { text: ["To join, send an enquiry or message the gym on WhatsApp. They'll take you through the plans and payment."], actions: [{ label: "Enquire now", action: "scroll:#enquire" }, { label: "WhatsApp the gym", href: waLink("Hi Muscle House! I'd like to join the gym."), kind: "wa" }] };
        var u = currentUser();
        return { text: ["Joining takes about a minute:"], steps: true,
          list: ["Go to **Membership** and tap **Join on WhatsApp** on the plan you want.", u ? "You're already logged in" + (u.email ? " as **" + u.email + "**" : "") + ", so this step is done ✅" : "**Log in** or create a free account (email or **Continue with Google**).", "Tap **Continue on WhatsApp**. Your message with the plan and your details is ready; just press **send**.", "The gym replies with the **payment details**. Once they confirm, your plan shows under **My membership**."],
          actions: [{ label: "Choose a plan", action: "scroll:#membership", kind: "primary" }].concat(u ? [] : [{ label: "Log in / Sign up", action: "login" }]),
          chips: ["How do I pay?", "Membership prices", "What is My membership?"] };
      } },

    { id: "payment", keys: ["pay^2", "payment^2", "payments", "how to pay^2", "upi", "gpay", "google pay", "phonepe", "paytm", "card", "cash", "online payment", "bank", "transfer money", "qr"],
      reply: function () { return { text: ["There's **no online payment on this website**. Payment is arranged directly with the gym: " + (plansHidden() ? "call **" + GYM.phoneDisplay + "** and the team will explain how to pay." : "after you **Join on WhatsApp**, Muscle House replies with the payment details."), "🔒 The website will never ask for your card number, UPI PIN or OTP. Don't share those with anyone."],
        actions: [{ label: "How to join", ask: "How do I join?" }, { label: "WhatsApp the gym", href: waLink("Hi Muscle House! How can I pay for a membership?"), kind: "wa" }] }; } },

    { id: "forgot", keys: ["forgot^3", "forget^3", "reset^3", "reset password^2", "lost password", "change password^2", "password^1.5", "cant login^3", "cannot login^3", "unable to login^3", "login problem^3", "not able to login^3", "login not working^3"],
      reply: function () { return { text: ["No problem! To reset your password:"], steps: true,
        list: ["Tap **Log in** (the person icon at the top).", "Tap **Forgot password?** and enter your email.", "Open the email from us and set a new password. It can take a few minutes to arrive, so check your spam folder too."],
        after: ["If you signed up with **Google**, just use **Continue with Google**. There's no separate password."],
        actions: [{ label: "Open log in", action: "login" }] }; } },

    { id: "login", keys: ["login^2", "log in^2", "signin", "sign in^2", "sign up^1.5", "signup", "account^2", "create account^2", "register^1.5", "registration", "google^1.5", "gmail", "logout", "log out^2", "sign out"],
      reply: function () {
        var u = currentUser();
        var text = u ? ["You're logged in" + (u.email ? " as **" + u.email + "**" : "") + ". Tap the person icon at the top to see **My membership** or log out."]
                     : ["You can create a free account in seconds:"];
        return { text: text, steps: true,
          list: u ? null : ["Tap **Log in** (the person icon at the top).", "Choose **Continue with Google**, or use **Create account** with your name, email and a password (8+ characters).", "That's it. Your account is used to join plans and see **My membership**."],
          actions: [{ label: u ? "My membership" : "Log in / Sign up", action: u ? "account" : "login", kind: "primary" }],
          chips: ["Forgot password", "What is My membership?", "Is my data safe?"] };
      } },

    { id: "account", keys: ["my membership^3", "membership status^3", "status^2", "pending", "active", "expired", "expiry", "expire", "valid", "validity", "renew^2", "renewal^2", "end date", "when does my", "my plan^2", "my account", "not showing^2", "not visible^2"],
      reply: function () {
        var u = currentUser();
        return { text: ["**My membership** (person icon → My membership) shows your plans once the gym has recorded them:"],
          list: ["**Active**: shows your start and end dates.", "**Expired**: the plan has ended. To **renew**, just **Join on WhatsApp** again.", "Nothing showing yet? The gym adds it after confirming your payment. It appears when they use the **same email you log in with**."],
          actions: [{ label: u ? "Open My membership" : "Log in to view", action: u ? "account" : "login", kind: "primary" }] };
      } },

    { id: "location", keys: ["where^2", "location^2", "address^2", "located^2", "direction^2", "directions^2", "map^2", "route", "how to reach^2", "reach", "kaha^2", "kahan^2", "elli", "hsr", "landmark", "coffee house", "floor", "near", "nearby", "sector"],
      reply: function () { return { text: ["📍 **" + GYM.name + "**", GYM.address + ".", "It's on the **3rd floor of the Indian Coffee House Building** in HSR Layout Sector 2."],
        actions: [{ label: "Get directions", href: GYM.directions, kind: "primary" }, { label: "See the map", action: "scroll:#contact" }, { label: "Call the gym", href: GYM.phoneTel, kind: "call" }] }; } },

    { id: "timings", keys: ["time^2", "timing^2", "timings^2", "hour", "hours^2", "open^2", "opening^2", "close^2", "closing^2", "closes", "schedule", "when", "sunday^1.5", "holiday^1.5", "morning", "evening", "night", "kab^2", "today"],
      reply: function () { return { text: ["🕙 The gym's **listed closing time is " + GYM.closing + "**.", "Opening hours and weekend/holiday timings aren't listed here yet, so please check with the gym before you visit."],
        actions: [{ label: "Call " + GYM.phoneDisplay, href: GYM.phoneTel, kind: "call" }, { label: "Ask on WhatsApp", href: waLink("Hi Muscle House! What are your opening hours?"), kind: "wa" }] }; } },

    { id: "contact", keys: ["contact^2", "phone^2", "number^2", "call^2", "whatsapp^2", "mobile", "reach you", "talk^2", "speak", "human^2", "person", "staff", "owner", "manager", "talk to the gym^3", "customer care", "support", "help desk"],
      reply: function () { return { text: ["You can reach Muscle House directly:", "📞 **" + GYM.phoneDisplay + "**"],
        actions: [{ label: "Call now", href: GYM.phoneTel, kind: "call" }, { label: "WhatsApp", href: waLink("Hi Muscle House! I have a question."), kind: "wa" }, { label: "Send an enquiry", action: "scroll:#enquire" }] }; } },

    { id: "trainers", keys: ["trainer^2", "trainers^2", "personal training^3", "personal trainer^3", "pt^2", "coach^2", "coaching", "guidance", "instructor", "workout plan^2"],
      reply: function () { return { text: ["Members describe the trainers as **helpful and approachable**, and you can ask them for guidance on form, routines and getting started.", "For **personal training** options and charges, please ask the gym directly. Those details aren't listed on the website."],
        actions: [{ label: "Ask about personal training", href: waLink("Hi Muscle House! I'd like to know about personal training."), kind: "wa" }] }; } },

    { id: "facilities", keys: ["equipment^2", "equipments^2", "machine^2", "machines^2", "facility^2", "facilities^2", "amenities^2", "weights", "dumbbell", "dumbbells", "barbell", "clean", "hygiene",
        "parking^2", "shower^2", "locker^2", "changing room^2", "washroom^2", "toilet", "ac^2", "air conditioned^2", "steam^2", "sauna^2", "zumba^2", "yoga^2", "crossfit^2", "aerobics^2", "class^2", "classes^2",
        "diet^2", "nutrition^2", "supplement^2", "supplements^2", "women^2", "ladies^2", "female^2", "ladies timing^3", "ladies timings^3", "women timing^3", "women timings^3", "diet plan^3", "couple^2", "student^2", "discount^2", "offer^2", "offers^2", "refund^2", "freeze^2", "wifi^2", "towel^2", "cardio^2", "treadmill^2", "cycle", "kids^2", "age^2"],
      reply: function (text) {
        var unknown = unverifiedTerms(text);
        var base = "Google reviews highlight **high-quality equipment**, a **clean, well-maintained space** and a **motivating atmosphere**.";
        if (!unknown.length) return { text: [base, "For a full list of equipment and facilities, it's best to visit or ask the gym."],
          actions: [{ label: "Book a visit", action: "scroll:#enquire", kind: "primary" }, { label: "Ask on WhatsApp", href: waLink("Hi Muscle House! Could you tell me about your equipment and facilities?"), kind: "wa" }] };
        var topic = unknown.join(", ");
        return { text: ["I don't have confirmed details about **" + topic + "**, and I'd rather not guess. The gym can answer that quickly.", base],
          actions: [{ label: "Ask on WhatsApp", href: waLink("Hi Muscle House! I'd like to know about " + topic + "."), kind: "wa" }, { label: "Call the gym", href: GYM.phoneTel, kind: "call" }] };
      } },

    { id: "reviews", keys: ["review^2", "reviews^2", "rating^2", "ratings^2", "google rating^3", "star", "stars", "feedback", "testimonial", "is it good", "good gym", "best gym", "worth"],
      reply: function () { return { text: ["⭐ Muscle House has a **" + GYM.rating + " Google rating** from **" + GYM.reviews + " reviews**.", "Members mention top-quality equipment, a clean, well-maintained setup, a motivating environment and helpful trainers."],
        actions: [{ label: "Read the reviews", href: GYM.reviewsUrl }, { label: "See highlights", action: "scroll:#reviews" }] }; } },

    { id: "trial", keys: ["trial^3", "free trial^3", "before joining^2", "try the gym^2", "try it out^2", "demo^2", "visit^2", "guest pass^3", "day pass^3", "try^2", "one day^2", "walk in", "see the gym^2", "tour^2"],
      reply: function () { return { text: ["You're welcome to visit! Send an **enquiry** or message the gym to plan your visit.", "Whether a **free trial or day pass** is available isn't listed on the website, so please ask the gym."],
        actions: [{ label: "Book a visit", action: "scroll:#enquire", kind: "primary" }, { label: "Ask about a trial", href: waLink("Hi Muscle House! Do you offer a trial or day pass?"), kind: "wa" }] }; } },

    { id: "enquiry", keys: ["enquiry^2", "enquire^2", "inquiry^2", "inquire", "form^2", "callback^2", "call back^2", "contact form", "book a visit^3", "book visit^2", "appointment"],
      reply: function () { return { text: ["The **enquiry form** asks for your name, phone, fitness goal and a good time to call. When you submit it, WhatsApp opens with your enquiry ready. Just press **send** to deliver it to the gym.", "The website itself doesn't store your enquiry."],
        actions: [{ label: "Open the enquiry form", action: "scroll:#enquire", kind: "primary" }] }; } },

    { id: "goals", keys: ["weight loss^3", "lose weight^3", "fat loss^3", "fat^2", "slim", "muscle gain^3", "gain muscle^3", "build muscle^3", "bulk", "strength^2", "beginner^2", "first time^2", "new to gym^3", "never been", "fitness goal^2", "tone", "abs"],
      reply: function () { return { text: ["Great goal! 💪 Whatever you're working towards, the trainers can guide you on where to start and how to train safely.", "Tell the gym your goal in the **enquiry form**, or mention it when you join."],
        actions: [{ label: "Share my goal", action: "scroll:#enquire", kind: "primary" }, { label: "Training at Muscle House", action: "scroll:#training" }] }; } },

    { id: "privacy", keys: ["privacy^2", "data^2", "safe^2", "secure^2", "security", "personal information", "information safe", "delete account^3", "delete my account^3", "remove account^2", "spam"],
      reply: function () { return { text: ["🔒 Your account only stores what's needed: your **name** and **email** (and your memberships once the gym records them). You can only ever see **your own** membership details.", "Enquiries and join requests go to the gym through **WhatsApp**; the website doesn't keep them. To delete your account, please ask the gym."],
        actions: [{ label: "Contact the gym", ask: "Talk to the gym" }] }; } },

    { id: "website", keys: ["website^2", "site^2", "how does this work^3", "how this works^3", "how it works^2", "what can you do^3", "features^2", "help^1.5", "guide", "menu", "sections", "use this", "who are you^2", "bot", "chatbot", "assistant"],
      reply: function () { return { text: ["Here's what you can do on this website:"],
        list: [plansHidden() ? "**Membership**: call **" + GYM.phoneDisplay + "** for plans and pricing." : "**Membership**: see plans and prices, and **Join on WhatsApp**.", "**Log in** (person icon): create an account with email or Google, and check **My membership**.", "**Training, Gallery & Reviews**: get a feel for the gym.", "**Visit**: address, map, directions and tap-to-call.", "**Enquiry form**: send your details and goal on WhatsApp.", "And me! I'm an automated assistant: I answer common questions instantly and pass anything else to the gym."],
        chips: CHIPS_START }; } },

    { id: "credit", keys: ["who made^3", "who built^3", "who designed^3", "developer^2", "designer^2", "website developer^3", "made this website^3", "built this website^3", "infinity^2", "web design^2", "website for my business^3", "your website"],
      reply: function () { return { text: ["This website was crafted by **∞ Infinity Web & Apps**.", "Want one for your business? Call **83174 80583**."],
        actions: [{ label: "Call Infinity Web & Apps", href: "tel:+918317480583", kind: "call" }] }; } }
  ];

  // Chip labels that map straight to a topic
  var CHIP_ROUTES = {
    "membership prices": "plans", "how do i join?": "join", "where is the gym?": "location", "gym timings": "timings",
    "talk to the gym": "contact", "how do i pay?": "payment", "personal training": "trainers", "forgot password": "forgot",
    "what is my membership?": "account", "is my data safe?": "privacy"
  };

  function answer(raw) {
    var routed = CHIP_ROUTES[String(raw).trim().toLowerCase()];
    var text = normalize(raw);
    var best = null, bestScore = 0;
    INTENTS.forEach(function (intent) {
      var s = routed ? (intent.id === routed ? 99 : 0) : score(text, intent);
      if (s > bestScore) { best = intent; bestScore = s; }
    });
    // Short greetings/thanks shouldn't hijack real questions ("hi, what are your timings")
    if (best && (best.id === "greet" || best.id === "thanks") && text.split(" ").length > 3) {
      var alt = null, altScore = 0;
      INTENTS.forEach(function (it) { if (it.id !== "greet" && it.id !== "thanks") { var s = score(text, it); if (s > altScore) { alt = it; altScore = s; } } });
      if (alt && altScore >= 2) { best = alt; bestScore = altScore; }
    }
    if (best && bestScore >= 2) return { intent: best.id, reply: best.reply(text) };
    return { intent: "fallback", reply: {
      text: ["Sorry, I'm not sure about that one. 🤔 I'm an automated assistant and only answer questions I have verified information for.", "The gym can help you directly:"],
      actions: [{ label: "Ask the gym on WhatsApp", href: waLink("Hi Muscle House! I have a question: " + String(raw).slice(0, 300)), kind: "wa" }, { label: "Call " + GYM.phoneDisplay, href: GYM.phoneTel, kind: "call" }],
      chips: CHIPS_START } };
  }
  // Exposed for testing and for the page's own use
  window.MHChat = { answer: answer };

  /* =====================================================================
     UI
     ===================================================================== */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function md(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/_([^_]+)_/g, "<em>$1</em>"); }

  var root = document.createElement("div");
  root.className = "mhchat";
  root.innerHTML =
    '<button class="mhchat__launch" type="button" aria-expanded="false" aria-controls="mhchat-panel" data-chat-launch>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z"/><circle cx="9" cy="9.5" r="1.1"/><circle cx="12" cy="9.5" r="1.1"/><circle cx="15" cy="9.5" r="1.1"/></svg>' +
      '<span class="mhchat__launch-label">Ask Muscle House</span>' +
    '</button>' +
    '<section class="mhchat__panel" id="mhchat-panel" role="dialog" aria-modal="false" aria-labelledby="mhchat-title" hidden>' +
      '<header class="mhchat__head">' +
        '<img class="mhchat__avatar" src="assets/img/logo-emblem.webp" width="40" height="40" alt="">' +
        '<div><h2 class="mhchat__title" id="mhchat-title">Muscle House Assistant</h2><p class="mhchat__sub"><span class="mhchat__dot" aria-hidden="true"></span>Automated help · instant answers</p></div>' +
        '<button class="mhchat__close" type="button" aria-label="Close chat" data-chat-close>×</button>' +
      '</header>' +
      '<div class="mhchat__log" role="log" aria-live="polite" aria-relevant="additions" data-chat-log></div>' +
      '<div class="mhchat__chips" data-chat-chips></div>' +
      '<form class="mhchat__form" data-chat-form autocomplete="off">' +
        '<label class="sr-only" for="mhchat-input">Type your question</label>' +
        '<input id="mhchat-input" type="text" maxlength="300" placeholder="Ask about plans, joining, timings…" data-chat-input>' +
        '<button class="mhchat__send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/></svg></button>' +
      '</form>' +
    '</section>';
  document.body.appendChild(root);

  var launch = root.querySelector("[data-chat-launch]"), panel = root.querySelector(".mhchat__panel"),
      log = root.querySelector("[data-chat-log]"), chipsBox = root.querySelector("[data-chat-chips]"),
      form = root.querySelector("[data-chat-form]"), input = root.querySelector("[data-chat-input]");
  var started = false;

  function openChat() {
    panel.hidden = false; root.classList.add("is-open"); launch.setAttribute("aria-expanded", "true");
    if (!started) { started = true; bot(answer("hello").reply, true); }
    window.setTimeout(function () { input.focus({ preventScroll: true }); }, 50);
  }
  function closeChat(returnFocus) {
    panel.hidden = true; root.classList.remove("is-open"); launch.setAttribute("aria-expanded", "false");
    if (returnFocus !== false) launch.focus();
  }
  launch.addEventListener("click", function () { if (panel.hidden) openChat(); else closeChat(); });
  root.querySelector("[data-chat-close]").addEventListener("click", function () { closeChat(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden && !document.querySelector("dialog[open]")) closeChat(); });

  function scrollLog() { log.scrollTop = log.scrollHeight; }

  function userMsg(text) {
    var el = document.createElement("div");
    el.className = "mhchat__msg mhchat__msg--user";
    el.textContent = text;
    log.appendChild(el); scrollLog();
  }

  function bot(reply, instant) {
    setChips([]);
    var typing = document.createElement("div");
    typing.className = "mhchat__msg mhchat__msg--bot mhchat__typing";
    typing.setAttribute("aria-label", "Assistant is typing");
    typing.innerHTML = "<span></span><span></span><span></span>";
    if (!instant && !reduceMotion) { log.appendChild(typing); scrollLog(); }
    var words = (reply.text || []).join(" ").split(" ").length;
    window.setTimeout(function () {
      if (typing.parentNode) typing.remove();
      var el = document.createElement("div");
      el.className = "mhchat__msg mhchat__msg--bot";
      var html = (reply.text || []).map(function (t) { return "<p>" + md(t) + "</p>"; }).join("");
      if (reply.list && reply.list.length) {
        var tag = reply.steps ? "ol" : "ul"; // numbered for step-by-step answers
        html += "<" + tag + ">" + reply.list.map(function (t) { return "<li>" + md(t) + "</li>"; }).join("") + "</" + tag + ">";
      }
      (reply.after || []).forEach(function (t) { html += "<p>" + md(t) + "</p>"; });
      el.innerHTML = html;
      if (reply.actions && reply.actions.length) {
        var row = document.createElement("div");
        row.className = "mhchat__actions";
        reply.actions.forEach(function (a) {
          var b;
          if (a.href) {
            b = document.createElement("a"); b.href = a.href;
            if (!/^tel:/.test(a.href)) { b.target = "_blank"; b.rel = "noopener"; }
          } else { b = document.createElement("button"); b.type = "button"; }
          b.className = "mhchat__action" + (a.kind ? " mhchat__action--" + a.kind : "");
          b.textContent = a.label;
          b.addEventListener("click", function () { runAction(a); });
          row.appendChild(b);
        });
        el.appendChild(row);
      }
      log.appendChild(el);
      setChips(reply.chips || []);
      // Show the start of a long answer rather than its end
      log.scrollTop = el.offsetHeight > log.clientHeight - 24 ? el.offsetTop - 12 : log.scrollHeight;
    }, instant || reduceMotion ? 0 : Math.min(350 + words * 12, 900));
  }

  function setChips(list) {
    chipsBox.innerHTML = "";
    list.forEach(function (label) {
      var c = document.createElement("button");
      c.type = "button"; c.className = "mhchat__chip"; c.textContent = label;
      c.addEventListener("click", function () { ask(label); });
      chipsBox.appendChild(c);
    });
    chipsBox.hidden = !list.length;
  }

  function runAction(a) {
    if (a.ask) { ask(a.ask); return; }
    if (!a.action) return;
    var small = window.matchMedia("(max-width: 640px)").matches;
    if (a.action.indexOf("scroll:") === 0) {
      var target = document.querySelector(a.action.slice(7));
      if (small) closeChat(false);
      if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      return;
    }
    if (a.action === "login" || a.action === "account") {
      var btn = document.querySelector(".nav__account[data-account-btn]");
      if (!btn || btn.hidden) { ask("Talk to the gym"); return; }
      closeChat(false);
      btn.click();
    }
  }

  function ask(text) {
    text = String(text || "").trim();
    if (!text) return;
    userMsg(text);
    bot(answer(text).reply);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = input.value;
    input.value = "";
    ask(t);
  });
})();
