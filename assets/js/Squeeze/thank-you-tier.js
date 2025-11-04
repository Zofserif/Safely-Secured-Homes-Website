/**
 * thank-you-tier.js
 * Dynamically personalizes the thank-you page based on lead tier (Hot/Warm/Nurture).
 * - Shows the CTA button only for Warm leads.
 * - Reads tier from: ?tier=, then sessionStorage.autoReplyPayload, then localStorage fallback.
 *
 * Setup:
 * 1) In thank-you.html:
 *    - <h2 id="tyTitle">...</h2>
 *    - <h3 id="tySubtitle">...</h3>
 *    - <button id="tyCta" class="btn btn-primary d-none" type="button">BOOK A CALL NOW</button>
 * 2) Include this script BEFORE assets/js/emailAutoReply.js.
 */

(function () {
  // ---------- Helpers ----------
  function getParam(name) {
    var v = new URLSearchParams(location.search).get(name);
    return v ? decodeURIComponent(v) : "";
  }
  function safeParse(json) {
    try { return JSON.parse(json || "{}"); } catch { return {}; }
  }
  function normalizeTier(t) {
    if (/^hot$/i.test(t)) return "Hot";
    if (/^warm$/i.test(t)) return "Warm";
    if (/^nurture$/i.test(t)) return "Nurture";
    return "Warm"; // sensible default
  }

  // ---------- Determine Tier ----------
  var urlTier = getParam("tier");
  var payload = safeParse(sessionStorage.getItem("autoReplyPayload"));
  var sessionTier = payload.lead_tier || "";
  var rawTier = urlTier || sessionTier || localStorage.getItem("ssh_last_tier") || "";
  var tier = normalizeTier(String(rawTier).trim());

  // Persist light fallback for later visits
  localStorage.setItem("ssh_last_tier", tier);
  if (payload.lead_score != null) {
    try { localStorage.setItem("ssh_last_score", String(payload.lead_score)); } catch (e) {}
  }

  // ---------- DOM Hooks ----------
  var titleEl = document.getElementById("tyTitle") || document.querySelector(".display-3, h2");
  var subEl   = document.getElementById("tySubtitle") || document.querySelector("h3, .lead");
  var btnEl   = document.getElementById("tyCta") || document.querySelector("button.btn-primary");

  // ---------- Content Config ----------
  // Replace these URLs with your real links
  var planUrl  = "/form.html";
  var bookUrl  = "https://calendly.com/vallarta-troy/30min"; // <-- put real booking link
  var guideUrl = "/assets/bonus/5-must-have-secrets.pdf"; // <-- put real guide link if needed

  var config = {
    Hot: {
      title: "Congratulations",
      sub:   "You are an excellent fit for our services! Our team is excited to assist you in achieving your goals. Expect a call from us within the next 24 hours to discuss the next steps.",
      // CTA hidden for Hot
    },
    Warm: {
      title: "Congratulations on taking the next step!",
      sub:   "A short discovery call will speed things up and avoid guesswork. Pick a time that works for you.",
      cta:   { text: "Book a 15-min Discovery Call", url: bookUrl, track: "cta_warm" }
    },
    Nurture: {
      title: "Thank You for Your Interest!",
      sub:   "Check your inbox for your plan and quick-win tips. Explore when you’re ready — we’re here to help."
      // CTA hidden for Nurture
    }
  };

  var chosen = config[tier];

  // ---------- Apply Copy ----------
  if (titleEl) titleEl.textContent = chosen.title;
  if (subEl)   subEl.textContent   = chosen.sub;

  // ---------- CTA: only for Warm ----------
  var isWarm = tier === "Warm";
  if (btnEl) {
    // Hide by default unless Warm
    btnEl.classList.toggle("d-none", !isWarm);

    if (isWarm && chosen.cta) {
      btnEl.textContent = chosen.cta.text || "Continue";
      btnEl.onclick = function () {
        try { window.gtag && gtag("event", chosen.cta.track || "cta_click", { tier: tier }); } catch (e) {}
        var target = chosen.cta.url || planUrl;
        if (target === "#" || !target) return;
        location.href = target;
      };
    } else {
      // Ensure no stray handler for Hot/Nurture
      btnEl.onclick = null;
    }
  }

  // ---------- Optional: subtle background accent by tier ----------
  var container = document.querySelector("section.mt-5 .container, .ty-container, main .container");
  if (container) {
    container.classList.remove("bg-success-subtle","bg-warning-subtle","bg-secondary-subtle","rounded-4","p-3");
    container.classList.add("rounded-4","p-3",
      tier === "Hot"     ? "bg-success-subtle"  :
      tier === "Nurture" ? "bg-secondary-subtle": "bg-warning-subtle"
    );
  }

  // ---------- Analytics view ping (safe no-op) ----------
  try { window.gtag && gtag("event", "lead_tier_view", { tier: tier }); } catch (e) {}
})();
