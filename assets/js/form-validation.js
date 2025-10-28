// app-form.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("myForm");
  if (!form) return;

  // =========================
  // (A) NAME GUARDS (kept)
  // =========================
  (function initNameGuards(selector = ".js-name") {
    const inputs = document.querySelectorAll(selector);
    if (!inputs.length) return;

    const DISALLOWED = /[^\p{L}\p{M}\s'’-]/gu; // letters, combining marks, space, hyphen, apostrophe
    const DISALLOWED_ASCII = /[^A-Za-z\s'’-]/g;

    const sanitize = (s) => {
      if (s == null) return "";
      let out = s.normalize ? s.normalize("NFC") : s;
      try {
        out = out.replace(DISALLOWED, "");
      } catch {
        out = out.replace(DISALLOWED_ASCII, "");
      }
      return out.replace(/\s{2,}/g, " ");
    };

    const insertAtCursor = (el, text) => {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      el.value = el.value.slice(0, start) + text + el.value.slice(end);
      const pos = start + text.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {}
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };

    inputs.forEach((el) => {
      el.setAttribute("inputmode", "text");
      el.setAttribute(
        "autocomplete",
        el.id?.toLowerCase().includes("last") ? "family-name" : "given-name"
      );

      el.addEventListener("beforeinput", (e) => {
        if (!e.data) return; // ignore deletions
        const cleaned = sanitize(e.data);
        if (cleaned !== e.data) e.preventDefault();
      });

      el.addEventListener("input", () => {
        const cleaned = sanitize(el.value);
        if (el.value !== cleaned) {
          const pos = el.selectionStart ?? cleaned.length;
          const delta = el.value.length - cleaned.length;
          el.value = cleaned;
          try {
            el.setSelectionRange(
              Math.max(0, pos - delta),
              Math.max(0, pos - delta)
            );
          } catch {}
        }
      });

      el.addEventListener("paste", (e) => {
        e.preventDefault();
        const raw = (e.clipboardData || window.clipboardData).getData("text");
        insertAtCursor(el, sanitize(raw));
      });

      el.addEventListener("drop", (e) => {
        e.preventDefault();
        const raw = e.dataTransfer?.getData("text") ?? "";
        insertAtCursor(el, sanitize(raw));
      });
    });
  })();

  // ==================================================
  // (B) LIGHT VALIDATION UI (checkbox groups handled separately)
  // ==================================================
  form.setAttribute("novalidate", "");
  let attemptedSubmit = false;

  const controls = Array.from(form.querySelectorAll("input, textarea, select"));

  function ensureInvalidFeedback(
    el,
    defaultMsg = "Please fill out this field."
  ) {
    const wrap = el.closest(".mb-3, .form-group") || el.parentElement;
    if (!wrap) return null;
    let fb = wrap.querySelector(".invalid-feedback");
    if (!fb) {
      fb = document.createElement("div");
      fb.className = "invalid-feedback";
      wrap.appendChild(fb);
    }
    const msg =
      el.type === "email"
        ? "Please enter a valid email address."
        : el.type === "tel"
        ? "Please enter a valid mobile number."
        : el.tagName === "SELECT"
        ? "Please choose an option."
        : defaultMsg;
    fb.textContent = msg;
    return fb;
  }

  function showFieldError(el) {
    el.classList.add("is-invalid");
    el.setAttribute("aria-invalid", "true");
    ensureInvalidFeedback(el);
  }

  function clearFieldError(el) {
    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
    const wrap = el.closest(".mb-3, .form-group") || el.parentElement;
    const fb = wrap && wrap.querySelector(".invalid-feedback");
    if (fb) fb.textContent = fb.textContent;
  }

  // Non-checkbox inputs/selects validator (checkbox groups handled below)
  function validateField(el, { from = "" } = {}) {
    if (el.disabled || el.readOnly) return;

    // Standalone checkbox (e.g., consent)
    if (el.type === "checkbox") {
      const group = el.closest("[data-minchecked], [data-maxchecked]");
      if (group) return; // group logic owns it
      const valid = el.checkValidity() && el.checked;
      el.classList.toggle("is-valid", el.checked);
      if (!el.checked) el.classList.remove("is-valid"); // never keep green when unchecked
      el.classList.toggle("is-invalid", attemptedSubmit && !valid);
      el.setAttribute(
        "aria-invalid",
        attemptedSubmit && !valid ? "true" : "false"
      );
      return;
    }

    el.setCustomValidity("");
    const invalid = !el.checkValidity();

    // If empty and user hasn't tried yet, keep neutral
    if (
      (el.value == null || el.value.trim() === "") &&
      !attemptedSubmit &&
      from !== "blur"
    ) {
      el.classList.remove("is-valid", "is-invalid");
      return;
    }

    if (invalid) {
      el.classList.remove("is-valid");
      if (attemptedSubmit || from === "blur" || from === "change") {
        el.classList.add("is-invalid");
        showFieldError(el);
      }
    } else {
      el.classList.remove("is-invalid");
      el.classList.add("is-valid");
      el.setAttribute("aria-invalid", "false");
    }
  }

  // Select-driven free-text reasons (e.g., "Maybe later" / "Not now")
  (function initSelectReasonInputs() {
    const selects = document.querySelectorAll("select[data-freeinput-on]");
    if (!selects.length) return;

    selects.forEach((select) => {
      // Build regex list from the pipe-separated triggers
      const triggers = (select.dataset.freeinputOn || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => new RegExp(`^${s}$`, "i"));

      // Create the extra input
      const wrap = select.closest(".mb-3, .form-group") || select.parentElement;
      const extra = document.createElement("input");
      extra.type = "text";
      extra.className =
        "form-control mt-2 rounded-4 shadow d-none js-freeinput-reason";
      extra.placeholder =
        select.dataset.freeinputPlaceholder || "Please tell us more";
      extra.name = (select.name || "detail") + "_reason";
      extra.maxLength = 160;
      wrap.appendChild(extra);

      // Hook into your validation
      extra.addEventListener("input", () =>
        validateField(extra, { from: "input" })
      );
      extra.addEventListener("change", () =>
        validateField(extra, { from: "change" })
      );
      extra.addEventListener("blur", () =>
        validateField(extra, { from: "blur" })
      );

      // Show/hide logic
      const sync = (from = "") => {
        const opt = select.options[select.selectedIndex];
        const val = (select.value || "").trim();
        const txt = (opt?.text || "").trim();
        const hit = triggers.some((rx) => rx.test(val) || rx.test(txt));

        if (hit) {
          extra.classList.remove("d-none");
          extra.required = true; // required only while triggered
          if (
            typeof attemptedSubmit !== "undefined" &&
            attemptedSubmit &&
            from
          ) {
            extra.dispatchEvent(new Event("blur", { bubbles: true }));
          }
        } else {
          extra.required = false;
          extra.value = "";
          extra.classList.add("d-none");
          extra.classList.remove("is-valid", "is-invalid");
          extra.removeAttribute("aria-invalid");
        }
      };

      select.addEventListener("change", () => sync("change"));
      sync(); // initialize on load (handles preselected state)
    });
  })();

  // Safety level slider (live badge + validation hook)
  (function initSafetyLevel() {
    const input = form.querySelector("#safety_level");
    const badge = form.querySelector("#safetyBadge");
    if (!input || !badge) return;

    const sync = () => {
      badge.textContent = `${input.value} / 10`;
    };
    input.addEventListener("input", sync);
    input.addEventListener("change", () =>
      validateField(input, { from: "change" })
    );
    sync(); // initial
  })();

  controls.forEach((el) => {
    el.addEventListener("input", () => validateField(el, { from: "input" }));
    el.addEventListener("change", () => validateField(el, { from: "change" }));
    el.addEventListener("blur", () => validateField(el, { from: "blur" }));
  });

  // ==================================================
  // (C) MULTI-STEP WIZARD + PROGRESS
  // ==================================================
  const steps = Array.from(form.querySelectorAll(".form-step"));
  const hasWizard = steps.length > 0;
  const progressBar = document.getElementById("progressBar");
  let current = 0;

  const progressWrap = progressBar
    ? progressBar.closest(".mb-3") || progressBar.closest(".progress")
    : null;

  // Hide the progress UI until the user starts
  if (progressWrap) {
    progressWrap.style.display = "none";
    progressWrap.setAttribute("aria-hidden", "true");
  }

  // Ensure AOS is initialized & can replay
  if (window.AOS && !window.__AOS_READY__) {
    try {
      AOS.init({ once: false });
      window.__AOS_READY__ = true;
    } catch {}
  }

  // --- Helper to replay AOS animation on a specific element
  function replayAOS(el) {
    if (!el) return;
    // If AOS is present, mimic its replay by toggling the aos-animate class
    el.classList.add("aos-init"); // makes sure base styles are applied
    el.classList.remove("aos-animate");
    // Force reflow so the browser sees a transition from initial -> animated
    void el.offsetWidth;
    // Next frame: add the animate class back
    requestAnimationFrame(() => {
      el.classList.add("aos-animate");
      // Optional: refresh AOS positions
      try {
        window.AOS && AOS.refresh();
      } catch {}
    });
  }

  function replayStepAnimation(stepEl) {
    if (!stepEl) return;

    // --- CSS fallback (works even without AOS) ---
    stepEl.classList.remove("step-enter-active");
    void stepEl.offsetWidth; // reflow
    stepEl.classList.add("step-enter-active");

    // --- AOS path ---
    if (window.AOS) {
      const nodes = [];
      if (stepEl.hasAttribute("data-aos")) nodes.push(stepEl);
      stepEl.querySelectorAll("[data-aos]").forEach((n) => nodes.push(n));

      // Reset AOS classes so it can re-apply them
      nodes.forEach((n) => {
        n.classList.remove("aos-animate");
        n.classList.remove("aos-init");
      });

      // Reflow, refresh, then force a scroll event so AOS marks them visible
      void stepEl.offsetWidth;
      try {
        AOS.refreshHard();
      } catch {
        try {
          AOS.refresh();
        } catch {}
      }
      requestAnimationFrame(() => window.dispatchEvent(new Event("scroll")));
    }
  }

  function showStep(i) {
    if (!hasWizard) return;

    steps.forEach((s, idx) => s.classList.toggle("d-none", idx !== i));
    current = i;

    // Only show progress once the user leaves the welcome step
    if (progressBar && progressWrap) {
      if (i === 0) {
        progressWrap.style.display = "none";
        progressWrap.setAttribute("aria-hidden", "true");
      } else {
        progressWrap.style.display = "";
        progressWrap.removeAttribute("aria-hidden");
        const pct = Math.max(5, Math.round((i / (steps.length - 1)) * 100));
        progressBar.style.width = pct + "%";
        progressBar.setAttribute("aria-valuenow", String(pct));
      }
    }

    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
    const stepEl = steps[i];
    replayStepAnimation(stepEl);

    const first = stepEl.querySelector("input, select, textarea, button");
    if (first)
      try {
        first.focus({ preventScroll: false });
      } catch {}
  }

  function groupHelper(min, max) {
    const hasMax = Number.isFinite(max);
    if (min > 0 && hasMax) return `Please select at least ${min} (max ${max}).`;
    if (min > 0) return `Please select at least ${min}.`;
    if (hasMax) return `Please select up to ${max}.`;
    return "";
  }

  // --- "Not sure" mutual exclusivity + explain input ---
  const NOT_SURE_RX = /^\s*not\s*sure\b/i;

  function _labelTextFor(input) {
    const lbl = input.closest(".form-check")?.querySelector("label");
    return ((input.value || "") + " " + (lbl?.textContent || "")).trim();
  }

  function findNotSureBox(group) {
    return Array.from(group.querySelectorAll('input[type="checkbox"]')).find(
      (b) => NOT_SURE_RX.test(_labelTextFor(b))
    );
  }

  function makeNotSureExplainInput(nameHint) {
    const input = document.createElement("input");
    input.type = "text";
    input.className =
      "form-control mt-2 rounded-4 shadow js-notsure-input d-none";
    input.placeholder = "Optional: tell us more";
    const baseName = (nameHint || "notsure").replace(/\[\]$/, "");
    input.name = `${baseName}_notsure_note`;
    input.maxLength = 160;
    return input;
  }

  function getOrCreateNotSureInput(nsBox) {
    const holder = nsBox.closest(".form-check") || nsBox.parentElement;
    let inp = holder.querySelector(".js-notsure-input");
    if (!inp) {
      inp = makeNotSureExplainInput(nsBox.name);
      holder.appendChild(inp);
      // live validation for this dynamic control
      inp.addEventListener("input", () =>
        validateField(inp, { from: "input" })
      );
      inp.addEventListener("change", () =>
        validateField(inp, { from: "change" })
      );
      inp.addEventListener("blur", () => validateField(inp, { from: "blur" }));
    }
    return inp;
  }

  function syncNotSureExplain(group) {
    const ns = findNotSureBox(group);
    if (!ns) return;
    const inp = getOrCreateNotSureInput(ns);

    if (ns.checked) {
      inp.classList.remove("d-none");
      inp.required = true; // required ONLY while "Not sure" is checked
      if (attemptedSubmit) validateField(inp, { from: "change" });
    } else {
      inp.required = false;
      inp.value = "";
      inp.classList.add("d-none");
      inp.classList.remove("is-valid", "is-invalid");
      inp.removeAttribute("aria-invalid");
    }
  }

  function applyNotSureRules(group, changedBox) {
    const ns = findNotSureBox(group);
    if (!ns) return;

    if (changedBox === ns && ns.checked) {
      // "Not sure" selected → clear others
      group.querySelectorAll('input[type="checkbox"]').forEach((b) => {
        if (b !== ns) b.checked = false;
      });
    } else if (ns.checked && changedBox !== ns && changedBox.checked) {
      // Another option selected while "Not sure" is on → turn "Not sure" off
      ns.checked = false;
    }
    // Keep the explain input in sync with current "Not sure" state
    syncNotSureExplain(group);
  }

  function ensureGroupFeedback(group, text = "") {
    // reuse author-provided node or create one
    let fb = group.querySelector(".group-feedback");
    if (!fb) {
      fb =
        group.querySelector(".invalid-feedback, .form-text") ||
        document.createElement("div");
      if (!fb.parentElement) group.appendChild(fb);
    }
    // default: muted helper, always visible
    fb.className = "group-feedback form-text text-muted";
    fb.textContent = text;
    fb.style.display = "";
    return fb;
  }

  // Initialize groups to muted helper (and set up "Not sure" UI)
  function initializeCheckboxGroup(group) {
    const min = parseInt(group.dataset.minchecked || "0", 10);
    const max = group.dataset.maxchecked
      ? parseInt(group.dataset.maxchecked, 10)
      : Infinity;
    ensureGroupFeedback(group, groupHelper(min, max));
    group.removeAttribute("aria-invalid");
    group.dataset.touched = "0";
    // Clean any leftover red/green from server-side markup
    group.querySelectorAll('input[type="checkbox"]').forEach((b) => {
      b.classList.remove("is-invalid", "is-valid");
      b.removeAttribute("aria-invalid");
      b.removeAttribute("disabled"); // will be re-applied if at max
    });

    // Ensure "Not sure" explain input exists & is in correct state
    const ns = findNotSureBox(group);
    if (ns) getOrCreateNotSureInput(ns);
    syncNotSureExplain(group);
  }

  // ✅ replaces your current validateCheckboxGroup
  function validateCheckboxGroup(group, { showErrors = false } = {}) {
    // include disabled so we can re-enable them later
    const boxes = Array.from(group.querySelectorAll('input[type="checkbox"]'));
    const min = parseInt(group.dataset.minchecked || "0", 10);
    const max = group.dataset.maxchecked
      ? parseInt(group.dataset.maxchecked, 10)
      : Infinity;

    const checked = boxes.filter((b) => b.checked);
    const valid = checked.length >= min && checked.length <= max;

    // message + helper styles
    const msgWhenInvalid =
      checked.length > max
        ? `Please select no more than ${max}.`
        : `Please select at least ${min}.`;

    const fb = ensureGroupFeedback(
      group,
      valid ? groupHelper(min, max) : msgWhenInvalid
    );
    fb.className =
      showErrors && !valid
        ? "group-feedback invalid-feedback d-block"
        : "group-feedback form-text text-muted";

    // items: never red; only green when valid AND checked
    boxes.forEach((b) => {
      if (valid && b.checked) b.classList.add("is-valid");
      else b.classList.remove("is-valid");
    });

    // 🔒 lock only while at max; unlock when below max
    const atMax = isFinite(max) && checked.length >= max;
    boxes.forEach((b) => {
      if (b.checked) return; // never disable already-checked items
      if (atMax) {
        if (!b.disabled) {
          b.dataset.lockedByMax = "1";
          b.disabled = true;
        }
      } else {
        if (b.dataset.lockedByMax === "1") {
          b.disabled = false;
          delete b.dataset.lockedByMax;
        }
      }
    });

    group.setAttribute("aria-invalid", showErrors && !valid ? "true" : "false");
    return valid;
  }

  function validateCheckboxGroups(scope = document, opts = {}) {
    const groups = Array.from(
      scope.querySelectorAll("[data-minchecked], [data-maxchecked]")
    );
    return groups.every((g) => validateCheckboxGroup(g, opts));
  }
  // -----------------------------------------------------------------

  function validateCurrentStep() {
    if (!hasWizard) return true;
    const step = steps[current];

    let ok = true;
    let firstBad = null;

    // Required non-checkbox fields (includes dynamic "Not sure"/"Other" text if required)
    const required = Array.from(
      step.querySelectorAll(
        'input:not([type="checkbox"])[required], select[required], textarea[required]'
      )
    );
    required.forEach((el) => {
      const valid = el.checkValidity();
      if (!valid) {
        ok = false;
        if (!firstBad) firstBad = el;
        showFieldError(el);
      } else {
        clearFieldError(el);
      }
    });

    // ✅ Checkbox groups – gate with showErrors: true (blocks Next on zero selection)
    const groupsOk = validateCheckboxGroups(step, { showErrors: true });
    ok = groupsOk && ok;

    if (!groupsOk && !firstBad) {
      const badGroup = step.querySelector(
        "[data-minchecked], [data-maxchecked]"
      );
      if (badGroup)
        firstBad = badGroup.querySelector('input[type="checkbox"]') || badGroup;
    }

    if (!ok) {
      attemptedSubmit = true;
      if (firstBad)
        try {
          firstBad.focus({ preventScroll: false });
        } catch {}
    }
    return ok;
  }

  // Live updates: apply "Not sure" rules, then validate; items never red
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches('input[type="checkbox"]')) {
      const group = t.closest("[data-minchecked], [data-maxchecked]");
      if (group) {
        applyNotSureRules(group, t);
        validateCheckboxGroup(group, { showErrors: attemptedSubmit }); // UI reacts after first failure
      } else {
        // standalone checkbox (e.g., consent)
        t.classList.toggle("is-valid", t.checked);
        if (!t.checked) t.classList.remove("is-valid");
      }
    } else if (t.matches('select, input:not([type="checkbox"]), textarea')) {
      validateField(t, { from: "change" });
    }
  });

  // Next / Prev
  form.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const stepEl = steps[current];
      if (!validateCurrentStep()) {
        attemptedSubmit = true;
        // Re-render group errors on this step
        validateCheckboxGroups(stepEl, { showErrors: true });
        // Refresh other fields quickly
        Array.from(stepEl.querySelectorAll("input, select, textarea")).forEach(
          (el) => validateField(el, { from: "submit" })
        );
        return;
      }
      showStep(Math.min(current + 1, steps.length - 1));
    });
  });

  form.querySelectorAll("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showStep(Math.max(current - 1, 0));
    });
  });

  // Initialize groups to MUTED helper, normalize "Not sure", set up explain inputs
  Array.from(
    form.querySelectorAll("[data-minchecked], [data-maxchecked]")
  ).forEach((group) => {
    initializeCheckboxGroup(group);
    const ns = findNotSureBox(group);
    if (ns && ns.checked) {
      group.querySelectorAll('input[type="checkbox"]').forEach((b) => {
        if (b !== ns) b.checked = false;
      });
    }
    syncNotSureExplain(group);
  });
  // Render muted helpers on load (no red yet)
  validateCheckboxGroups(form, { showErrors: false });

  if (hasWizard) showStep(0);

  // ==================================================
  // (I) FREE-TEXT TRIGGERS for SELECTS ("Other" or "Not sure")
  //     + "Other" for checkbox/radio
  // ==================================================
  (function initFreeTextInputs() {
    // matches: "Other", "Others", "Not sure", "Not-sure", "Not sure—guide us", etc.
    const TRIGGER_RX = /\b(others?|not\s*[-–—]?\s*sure)\b/i;

    function makeFreeInput(baseEl, nameHint, placeholder = "Please specify") {
      const input = document.createElement("input");
      input.type = "text";
      input.className =
        "form-control mt-2 rounded-4 shadow js-freeinput d-none";
      input.placeholder = placeholder;
      const baseName = (nameHint || baseEl.name || "detail").replace(
        /\[\]$/,
        ""
      );
      input.name = `${baseName}_other`;
      input.maxLength = 160;
      input.addEventListener("input", () =>
        validateField(input, { from: "input" })
      );
      input.addEventListener("change", () =>
        validateField(input, { from: "change" })
      );
      input.addEventListener("blur", () =>
        validateField(input, { from: "blur" })
      );
      return input;
    }

    // ---- SELECT: show input when current option contains "Other" or "Not sure"
    function wireSelectFreeText(select) {
      const hasTrigger = Array.from(select.options).some((o) =>
        TRIGGER_RX.test((o.value || o.text || "").toLowerCase())
      );
      if (!hasTrigger) return;

      const wrap = select.closest(".mb-3, .form-group") || select.parentElement;
      const extra = makeFreeInput(select, select.name, "Tell us more");
      (wrap || select).appendChild(extra);

      const sync = (from = "") => {
        const opt = select.options[select.selectedIndex];
        const combined = (
          (select.value || "") +
          " " +
          (opt?.text || "")
        ).toLowerCase();
        const triggered = TRIGGER_RX.test(combined);

        if (/not\s*[-–—]?\s*sure/i.test(combined))
          extra.placeholder = "Optional: tell us more";
        else extra.placeholder = "Please specify";

        if (triggered) {
          extra.classList.remove("d-none");
          extra.required = true; // required only while triggered
          if (attemptedSubmit && from) {
            extra.dispatchEvent(new Event("blur", { bubbles: true }));
          }
        } else {
          extra.required = false;
          extra.value = "";
          extra.classList.add("d-none");
          extra.classList.remove("is-valid", "is-invalid");
          extra.removeAttribute("aria-invalid");
        }
      };

      select.addEventListener("change", () => sync("change"));
      sync(); // initialize
    }

    // ---- CHECKBOX/RADIO: "Other" only (your Not-sure handler already exists)
    function wireChoiceOther(input) {
      const label = input.closest(".form-check")?.querySelector("label");
      const text = (
        (input.value || "") +
        " " +
        (label?.textContent || "")
      ).trim();
      const OTHER_ONLY_RX = /\bothers?\b/i;
      if (!OTHER_ONLY_RX.test(text)) return;

      const holder = input.closest(".form-check") || input.parentElement;
      const extra = makeFreeInput(input, input.name, "Please specify");
      holder.appendChild(extra);

      const sync = (from = "") => {
        const active = input.checked;
        if (active) {
          extra.classList.remove("d-none");
          extra.required = true;
          if (attemptedSubmit && from)
            extra.dispatchEvent(new Event("blur", { bubbles: true }));
        } else {
          extra.required = false;
          extra.value = "";
          extra.classList.add("d-none");
          extra.classList.remove("is-valid", "is-invalid");
          extra.removeAttribute("aria-invalid");
        }
      };

      input.addEventListener("change", () => sync("change"));
      sync();
    }

    document.querySelectorAll("select").forEach(wireSelectFreeText);
    document
      .querySelectorAll('input[type="checkbox"], input[type="radio"]')
      .forEach(wireChoiceOther);
  })();

  // ==================================================
  // (J) HELPER GETTERS (kept)
  // ==================================================
  function qs(sel) {
    return form.querySelector(sel);
  }
  function qsa(sel) {
    return Array.from(form.querySelectorAll(sel));
  }
  function getVal(sel) {
    const el = qs(sel);
    return el && typeof el.value === "string" ? el.value.trim() : "";
  }
  function getSelectVal(name) {
    const el = qs(`[name="${name}"]`);
    return el ? (el.value || "").trim() : "";
  }
  function getChecks(name) {
    return qsa(`[name="${name}"]:checked`).map((el) => el.value);
  }

  // ==================================================
  // (K) LEAD SCORING + AUTO NOTES (kept)
  // ==================================================
  function computeScore() {
    let s = 0;

    const risk = getSelectVal("risk_window"); // Night/24/7/When traveling
    if (["Night", "24/7", "When I'm traveling"].includes(risk)) s += 2;

    const night = getSelectVal("night_lighting"); // Pretty dark
    if (night === "Pretty dark") s += 1;

    const areas = getChecks("priority_areas[]"); // >=3 or Whole perimeter
    if (areas.length >= 3 || areas.includes("Whole perimeter (360°)")) s += 2;

    const feats = getChecks("features_must[]"); // ColorVu/AcuSense
    if (feats.some((v) => /ColorVu|Human\/vehicle/.test(v))) s += 1;

    const setup = getSelectVal("current_setup"); // None / Full but outdated
    if (setup === "No Security System" || /Old System|outdated/i.test(setup))
      s += 1;

    const budget = getSelectVal("budget_band"); // rough mapping
    if (/All I can need/i.test(budget)) s += 2;
    if (/Feature Rich|Everything/i.test(budget)) s += 3;

    const tl = getSelectVal("timeline"); // ASAP/This week/This month
    if (tl === "ASAP" || tl === "This week" || tl === "This month") s += 3;

    const dm = getSelectVal("decision_makers"); // Me
    if (dm === "Me") s += 1;

    const incident = (qs('[name="incident_notes"]')?.value || "").trim();
    if (incident) s += 1;

    // inside computeScore()
    const safety = Number(
      form.querySelector('[name="safety_level"]')?.value || 0
    );
    if (safety <= 3) s += 1; // example: very low self-rated safety bumps priority

    return s;
  }

  function tierFromScore(s) {
    return s >= 12 ? "Hot" : s >= 8 ? "Warm" : "Nurture";
  }

  function autoNotes() {
    const notes = [];
    const risk = getSelectVal("risk_window");
    const night = getSelectVal("night_lighting");
    const areas = getChecks("priority_areas[]");
    const feats = getChecks("features_must[]");
    const storageNeed =
      feats.includes("30+ days storage") || feats.includes("24/7 recording");

    if (
      ["Night", "24/7", "When I'm traveling"].includes(risk) ||
      night === "Pretty dark"
    ) {
      notes.push(
        "Include ColorVu for full-color night imaging at key entries."
      );
    }
    if (
      areas.includes("Gate/Driveway") ||
      areas.includes("Street view/Plates")
    ) {
      notes.push(
        "Consider varifocal/longer reach for driveway/street (plates)."
      );
    }
    if (areas.length >= 3 || areas.includes("Whole perimeter (360°)")) {
      notes.push("Plan 6–8 cams for 360° with minimal blind spots.");
    }
    if (feats.some((v) => /Human\/vehicle/.test(v))) {
      notes.push("Enable AcuSense human/vehicle smart alerts.");
    }
    if (storageNeed) {
      notes.push("Size HDD for 30+ days or 24/7 recording as requested.");
    }
    return notes.join(" ");
  }

  // ==================================================
  // (L) CAPTURE VALUES BEFORE SMART FORMS REDIRECT (kept)
  // ==================================================
  function splitFullName(full) {
    if (!full) return { first: "", last: "" };
    const parts = full.trim().split(/\s+/);
    const first = parts.shift() || "";
    const last = parts.join(" ") || "";
    return { first, last };
  }

  function captureSubmissionValues() {
    const first = getVal('[name="firstName"]') || getVal("#firstName") || "";
    const last = getVal('[name="lastName"]') || getVal("#lastName") || "";
    let f = first,
      l = last;

    if (!first && !last) {
      const full =
        getVal('[name="full_name"]') || getVal('[name*="Full Name"]') || "";
      const split = splitFullName(full);
      f = split.first;
      l = split.last;
    }

    const email =
      getVal('[name="email"]') ||
      getVal("#email") ||
      getVal('[name="Email Address"]') ||
      getVal('input[type="email"]');

    const to_name = [f, l].filter(Boolean).join(" ").trim();

    const lead_score = String(computeScore());
    const lead_tier = tierFromScore(Number(lead_score));
    const notes = autoNotes();

    sessionStorage.setItem(
      "autoReplyPayload",
      JSON.stringify({
        first: f,
        last: l,
        email,
        to_name,
        lead_score,
        lead_tier,
        auto_notes: notes,
      })
    );

    const scoreEl = form.querySelector("#lead_score");
    const tierEl = form.querySelector("#lead_tier");
    const noteEl = form.querySelector("#auto_notes");
    if (scoreEl) scoreEl.value = lead_score;
    if (tierEl) tierEl.value = lead_tier;
    if (noteEl) noteEl.value = notes;

    // in form-validation.js, inside captureSubmissionValues() *after* lead_tier is computed
    localStorage.setItem("ssh_last_tier", lead_tier);
    localStorage.setItem("ssh_last_score", lead_score);

    return { lead_score, lead_tier, email, to_name };
  }

  // ==================================================
  // (M) SUBMIT HANDLER (kept; with step validation + scoring fill)
  // ==================================================
  form.addEventListener("submit", (e) => {
    // Validate last visible step (wizard gates previous ones)
    if (hasWizard && !validateCurrentStep()) {
      e.preventDefault();
      e.stopPropagation();
      attemptedSubmit = true;
      return;
    }

    if (!form.checkValidity()) {
      e.preventDefault();
      e.stopPropagation();
      attemptedSubmit = true;
      controls.forEach((el) => validateField(el, { from: "submit" }));
      const firstInvalid = form.querySelector(".is-invalid, :invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Valid → compute & store values, then ensure redirect carries tier/score
    const vals = captureSubmissionValues(); // { lead_score, lead_tier, email, to_name }

    // Append ?tier=&score= to data-bss-redirect-url (keeps Bootstrap Studio Smart Form flow)
    try {
      const current =
        form.getAttribute("data-bss-redirect-url") || "thank-you.html";
      const u = new URL(current, location.origin);
      if (vals && vals.lead_tier) u.searchParams.set("tier", vals.lead_tier);
      if (vals && vals.lead_score) u.searchParams.set("score", vals.lead_score);
      form.setAttribute("data-bss-redirect-url", u.pathname + u.search);
    } catch (e) {
      /* noop */
    }

    // allow Smart Forms to proceed normally
  });
});
