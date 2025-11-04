// emailAutoReply.js — Squeeze page: send ONE email, then redirect to results
(function () {
  // ─────────────────────────────────────────────────────────────────────────────
  // EmailJS IDs (replace with yours if needed)
  const EMAILJS_PUBLIC_KEY  = "SmP6rTJP04ORTpVg5";
  const EMAILJS_SERVICE_ID  = "service_6tzmz2d";
  const EMAILJS_TEMPLATE_ID = "template_6zkfgcq"; // only this one is sent

  // Page / UX settings
  const RESULTS_URL       = "results.html"; // change if your file lives elsewhere
  const REDIRECT_DELAY_MS = 400;            // brief pause so users see the status
  const SEND_GUARD_KEY    = `emailjs_sent:${EMAILJS_TEMPLATE_ID}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // UI helpers
  function getStatusEl() {
    let el = document.getElementById("status");
    if (!el) {
      el = document.createElement("p");
      el.id = "status";
      el.className = "muted";
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }
  function setStatus(msg) {
    const el = getStatusEl();
    el.textContent = msg || "";
  }
  function showContinue() {
    const btn = document.getElementById("continueBtn");
    if (btn) btn.classList.remove("d-none");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Load EmailJS (if not already on the page)
  function loadEmailJS() {
    return new Promise((resolve, reject) => {
      if (window.emailjs && window.emailjs.send) {
        try {
          window.emailjs.init(EMAILJS_PUBLIC_KEY);
        } catch (_) {}
        return resolve(window.emailjs);
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js";
      s.async = true;
      s.onload = function () {
        try {
          window.emailjs.init(EMAILJS_PUBLIC_KEY);
          resolve(window.emailjs);
        } catch (e) {
          reject(e);
        }
      };
      s.onerror = () => reject(new Error("Failed to load EmailJS SDK"));
      document.head.appendChild(s);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Data helpers
  function readPayload() {
    try {
      const raw = sessionStorage.getItem("autoReplyPayload");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function toMdBulletList(value) {
    if (Array.isArray(value)) return value.map(s => `• ${String(s).trim()}`).join("\n");
    const str = String(value || "").trim();
    if (!str) return "";
    // split on common separators, then bullet
    return str.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).map(s => `• ${s}`).join("\n");
  }

  // Build a robust param object so EmailJS templates can use different tokens
  function buildTemplateParams(p) {
    const name = (p.to_name || [p.first, p.last].filter(Boolean).join(" ")).trim();
    const first = (p.first || (name.split(/\s+/)[0] || "")).trim();
    const last  = (p.last  || (name.replace(new RegExp("^" + first + "\\b"), "").trim())).trim();

    return {
      // Email/recipient
      to_email: p.email || "",
      email:    p.email || "",
      to_name:  name,

      // Name aliases so any template token will work
      first, last,
      firstname: first, first_name: first, firstName: first,
      lastname:  last,  last_name:  last,  lastName:  last,

      // Lead meta
      lead_tier:  p.lead_tier || "",
      lead_score: p.lead_score || "",
      auto_notes: p.auto_notes || "",

      // Plan summary
      camera_count:        p.cameraCount || 0,
      camera_locations:    p.cameraRecommendedLocations || p.camera_locations || "",
      camera_locations_md: toMdBulletList(p.cameraRecommendedLocations || p.camera_locations || ""),
      nvr_channel:         p.nvrChannel || 0
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Results redirection with payload (works in export/new tabs)
  function redirectToResultsWithPayload() {
    try {
      const raw = sessionStorage.getItem("autoReplyPayload") || "{}";

      // backup: localStorage
      localStorage.setItem("autoReplyPayload", raw);

      // also pass via URL hash so it survives export & new tab
      const b64 = btoa(encodeURIComponent(raw));
      const url = new URL(RESULTS_URL, location.href);
      url.hash = "p=" + b64;

      location.assign(url.toString());
    } catch (e) {
      // last resort
      location.assign(RESULTS_URL);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main
  async function run() {
    // Wire up any manual Continue button to carry data even on failure
    const cont = document.getElementById("continueBtn");
    if (cont) cont.addEventListener("click", redirectToResultsWithPayload);

    const payload = readPayload();

    // Guard: if we have already sent this template this session, skip straight to results
    if (sessionStorage.getItem(SEND_GUARD_KEY) === "1") {
      setStatus("Taking you to your results…");
      return setTimeout(redirectToResultsWithPayload, REDIRECT_DELAY_MS);
    }

    if (!payload) {
      setStatus("We couldn't find your answers. Taking you to your results…");
      return setTimeout(redirectToResultsWithPayload, REDIRECT_DELAY_MS);
    }
    if (!payload.email) {
      setStatus("Missing email address. Taking you to your results…");
      // still go through; the results page can render without email
      return setTimeout(redirectToResultsWithPayload, REDIRECT_DELAY_MS);
    }

    // Prepare template params
    const templateParams = buildTemplateParams(payload);

    // Try to load EmailJS and send
    try {
      setStatus("Sending your consultation summary…");
      const ej = await loadEmailJS();
      await ej.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);

      // mark as sent to avoid duplicates
      sessionStorage.setItem(SEND_GUARD_KEY, "1");

      setStatus("Email sent! Redirecting to your results…");
      setTimeout(redirectToResultsWithPayload, REDIRECT_DELAY_MS);
    } catch (err) {
      console.error("[EmailJS] send failed:", err);
      setStatus("Sorry—there was a problem sending your email.");
      // Let the user continue manually; it will still carry the payload
      showContinue();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
