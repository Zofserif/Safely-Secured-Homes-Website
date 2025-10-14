// app-form.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('myForm');
  if (!form) return;

  // ---------- (A) NAME GUARDS: block digits/junk in .js-name ----------
  (function initNameGuards(selector = '.js-name') {
    const inputs = document.querySelectorAll(selector);
    if (!inputs.length) return;

    const DISALLOWED = /[^\p{L}\p{M}\s'’-]/gu;   // allow letters, combining marks, space, hyphen, apostrophe
    const DISALLOWED_ASCII = /[^A-Za-z\s'’-]/g;

    const sanitize = (s) => {
      if (s == null) return '';
      let out = s.normalize ? s.normalize('NFC') : s;
      try { out = out.replace(DISALLOWED, ''); }
      catch { out = out.replace(DISALLOWED_ASCII, ''); }
      return out.replace(/\s{2,}/g, ' ');
    };

    const insertAtCursor = (el, text) => {
      const start = el.selectionStart ?? el.value.length;
      const end   = el.selectionEnd   ?? el.value.length;
      el.value = el.value.slice(0, start) + text + el.value.slice(end);
      const pos = start + text.length;
      try { el.setSelectionRange(pos, pos); } catch {}
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    inputs.forEach(el => {
      el.setAttribute('inputmode', 'text');
      el.setAttribute('autocomplete',
        el.id?.toLowerCase().includes('last') ? 'family-name' : 'given-name'
      );

      el.addEventListener('beforeinput', (e) => {
        if (!e.data) return; // ignore deletions
        const cleaned = sanitize(e.data);
        if (cleaned !== e.data) e.preventDefault();
      });

      el.addEventListener('input', () => {
        const cleaned = sanitize(el.value);
        if (el.value !== cleaned) {
          const pos = el.selectionStart ?? cleaned.length;
          const delta = el.value.length - cleaned.length;
          el.value = cleaned;
          try { el.setSelectionRange(Math.max(0, pos - delta), Math.max(0, pos - delta)); } catch {}
        }
      });

      el.addEventListener('paste', (e) => {
        e.preventDefault();
        const raw = (e.clipboardData || window.clipboardData).getData('text');
        insertAtCursor(el, sanitize(raw));
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const raw = e.dataTransfer?.getData('text') ?? '';
        insertAtCursor(el, sanitize(raw));
      });
    });
  })();

  // ---------- (B) LIGHT VALIDATION UI (optional; keep Bootstrap classes in sync) ----------
  form.setAttribute('novalidate', '');
  let attemptedSubmit = false;

  const controls = Array.from(form.querySelectorAll('input, textarea, select'));

  function validateField(el, { from = '' } = {}) {
    if (el.disabled || el.readOnly) return;

    const isEmpty = !el.value || el.value.trim() === '';
    if (isEmpty) {
      el.setCustomValidity('');
      if (!attemptedSubmit) el.classList.remove('is-valid', 'is-invalid');
      return;
    }

    el.setCustomValidity('');
    const invalid = !el.checkValidity();

    if (invalid) {
      el.classList.remove('is-valid');
      if (attemptedSubmit || from === 'blur') el.classList.add('is-invalid');
      else el.classList.remove('is-invalid');
    } else {
      el.classList.remove('is-invalid');
      el.classList.add('is-valid');
    }
  }

  controls.forEach(el => {
    el.addEventListener('input',  () => validateField(el, { from: 'input' }));
    el.addEventListener('change', () => validateField(el, { from: 'change' }));
    el.addEventListener('blur',   () => validateField(el, { from: 'blur' }));
  });

  // ---------- (C) CAPTURE VALUES BEFORE SMART FORMS REDIRECT ----------
  function getVal(sel) {
    const el = form.querySelector(sel);
    return el && el.value ? el.value.trim() : '';
  }

  function captureSubmissionValues() {
    // Prefer exact names; fall back to ids/common patterns
    const first = getVal('[name="firstName"]') || getVal('#firstName') || getVal('.js-name[name*="first"]');
    const last  = getVal('[name="lastName"]')  || getVal('#lastName')  || getVal('.js-name[name*="last"]');
    const email = getVal('[name="email"]')     || getVal('#email')     || getVal('input[type="email"]');
    const to_name = [first, last].filter(Boolean).join(' ').trim();

    sessionStorage.setItem('autoReplyPayload', JSON.stringify({ first, last, email, to_name }));
  }

  form.addEventListener('submit', (e) => {
    if (!form.checkValidity()) {
      e.preventDefault();
      e.stopPropagation();
      attemptedSubmit = true;
      controls.forEach(el => validateField(el, { from: 'submit' }));
      const firstInvalid = form.querySelector('.is-invalid, :invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Valid → let Smart Forms submit normally, but first save the payload
    captureSubmissionValues();
    // DO NOT preventDefault here — Smart Forms needs to submit and redirect.
  });
});
