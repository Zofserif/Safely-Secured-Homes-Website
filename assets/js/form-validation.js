// app-form-validation.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('myForm');
  if (!form) return;

  // ========================
  // CONFIG
  // ========================
  const CONFIG = {
    quietWhenEmpty: true,         // hide validation UI when a field is empty (until submit)
    invalidOnBlur: true,          // add .is-invalid when leaving a field that's invalid
    tooltipOnlyAfterSubmit: true  // show tooltips only after first invalid submit
  };

  form.setAttribute('novalidate', '');
  let attemptedSubmit = false;

  // ========================
  // HELPERS
  // ========================
  const controls = Array.from(form.querySelectorAll('input, textarea, select'))
    .filter(el => !el.closest('[hidden], .d-none, [aria-hidden="true"]'));

  function shouldValidate(el) {
    return el.hasAttribute('required') ||
           el.hasAttribute('minlength') ||
           el.hasAttribute('maxlength') ||
           el.hasAttribute('pattern')   ||
           el.hasAttribute('min')       ||
           el.hasAttribute('max')       ||
           el.hasAttribute('step')      ||
           /^(email|url|number|tel)$/i.test(el.type) ||
           el.tagName === 'SELECT';
  }

  function patternTypeAllowed(type) {
    // pattern works on these types; not on number.
    return /^(text|search|tel|password|email|url)$/i.test(type || 'text');
  }

  function ensureTooltip(el) {
    if (!el.matches('[data-bs-toggle="tooltip"]')) return null;
    return bootstrap.Tooltip.getInstance(el) ||
           new bootstrap.Tooltip(el, { trigger: 'manual', container: 'body', placement: 'right' });
  }

  function setTooltipMessage(el, text) {
    const tip = ensureTooltip(el);
    if (!tip) return null;

    if (typeof tip.setContent === 'function') {
      tip.setContent({ '.tooltip-inner': text || '' });
    } else {
      // Bootstrap 5.0/5.1 fallback
      el.setAttribute('data-bs-original-title', text || '');
      el.setAttribute('title', text || '');
    }
    tip.update();
    return tip;
  }

  function getMessage(el) {
    const v = el.validity;
    const hasAttr = (name) => el.getAttribute(name);

    const msg = {
      required : el.dataset.msgRequired  || el.title || 'This field is required.',
      minlength: el.dataset.msgMinlength || (hasAttr('minlength') ? `Please enter at least ${el.minLength} characters.` : 'Too short.'),
      maxlength: el.dataset.msgMaxlength || (hasAttr('maxlength') ? `Please enter no more than ${el.maxLength} characters.` : 'Too long.'),
      pattern  : el.dataset.msgPattern   || 'Please match the requested format.',
      email    : el.dataset.msgEmail     || 'Please enter a valid email address.',
      url      : el.dataset.msgUrl       || 'Please enter a valid URL.',
      number   : el.dataset.msgNumber    || 'Please enter a valid number.',
      rangeUnderflow: el.dataset.msgMin  || (hasAttr('min') ? `Value must be ≥ ${el.min}.` : 'Value is too small.'),
      rangeOverflow : el.dataset.msgMax  || (hasAttr('max') ? `Value must be ≤ ${el.max}.` : 'Value is too large.'),
      stepMismatch  : el.dataset.msgStep || 'Please select a valid step value.'
    };

    if (v.valueMissing)     return msg.required;
    if (v.tooShort)         return msg.minlength;
    if (v.tooLong)          return msg.maxlength;
    if (v.patternMismatch)  return msg.pattern;
    if (v.typeMismatch) {
      if (el.type === 'email')  return msg.email;
      if (el.type === 'url')    return msg.url;
      if (el.type === 'number') return msg.number;
      return 'Please enter a valid value.';
    }
    if (v.rangeUnderflow)   return msg.rangeUnderflow;
    if (v.rangeOverflow)    return msg.rangeOverflow;
    if (v.stepMismatch)     return msg.stepMismatch;

    return el.validationMessage || 'Please enter a valid value.';
  }

  // Core validator
  function validateField(el, { source = 'generic', ignoreQuietEmpty = false } = {}) {
    if (el.disabled || el.readOnly || !shouldValidate(el)) return;

    // Warn if pattern on unsupported type
    if (el.hasAttribute('pattern') && !patternTypeAllowed(el.type)) {
      console.warn(`[validation] <input type="${el.type}"> ignores pattern=...  Use type="text".`, el);
    }

    const isEmpty = (el.value == null || el.value.trim() === '');

    // Quiet UI when empty (unless we're in submit pass)
    if (!ignoreQuietEmpty && CONFIG.quietWhenEmpty && isEmpty) {
      el.setCustomValidity('');
      el.classList.remove('is-invalid', 'is-valid');
      const t = ensureTooltip(el); if (t) t.hide();
      return;
    }

    // Reset & compute specific message
    el.setCustomValidity('');
    if (!el.checkValidity()) {
      el.setCustomValidity(getMessage(el));
    }
    const invalid = !el.checkValidity();

    // Classes
    if (invalid) {
      // Remove green check whenever invalid
      el.classList.remove('is-valid');

      // Show red if: after submit OR (invalidOnBlur and this was a blur)
      if (attemptedSubmit || (CONFIG.invalidOnBlur && source === 'blur')) {
        el.classList.add('is-invalid');
      } else {
        el.classList.remove('is-invalid');
      }
    } else {
      el.classList.remove('is-invalid');
      el.classList.add('is-valid');
    }

    // Tooltip only when invalid + focused + allowed by config
    const tip = setTooltipMessage(el, invalid ? el.validationMessage : '');
    if (tip) {
      const allow = !CONFIG.tooltipOnlyAfterSubmit || attemptedSubmit;
      if (invalid && allow && document.activeElement === el) tip.show();
      else tip.hide();
    }
  }

  // Bind listeners
  controls.forEach(el => {
    if (el.matches('[data-bs-toggle="tooltip"]')) ensureTooltip(el);

    el.addEventListener('blur',   () => validateField(el, { source: 'blur' }));
    el.addEventListener('change', () => validateField(el, { source: 'change' }));
    el.addEventListener('input',  () => validateField(el, { source: 'input' }));
    el.addEventListener('focusin',() => validateField(el, { source: 'focus' }));
  });

  // Submit handler
  form.addEventListener('submit', (e) => {
    if (!form.checkValidity()) {
      e.preventDefault();
      e.stopPropagation();
      attemptedSubmit = true;

      // On submit, always show UI even if empty
      controls.forEach(el => validateField(el, { source: 'submit', ignoreQuietEmpty: true }));

      const firstInvalid = form.querySelector('.is-invalid, :invalid');
      if (firstInvalid) firstInvalid.focus();
    }
    form.classList.add('was-validated');
  });

  // ========================
  // NAME GUARDS (block digits & junk)
  // Add class .js-name to first/last name inputs.
  // ========================
  (function initNameGuards(selector = '.js-name') {
    const inputs = document.querySelectorAll(selector);
    if (!inputs.length) return;

    // Allow: Unicode letters, combining marks, spaces, hyphen, apostrophe
    const DISALLOWED = /[^\p{L}\p{M}\s'’-]/gu;       // modern browsers
    const DISALLOWED_ASCII = /[^A-Za-z\s'’-]/g;      // fallback

    const sanitize = (s) => {
      if (s == null) return '';
      let out = (s.normalize ? s.normalize('NFC') : s);
      try { out = out.replace(DISALLOWED, ''); }
      catch { out = out.replace(DISALLOWED_ASCII, ''); }
      return out.replace(/\s{2,}/g, ' ');
    };

    const insertAtCursor = (el, text) => {
      const start = el.selectionStart ?? el.value.length;
      const end   = el.selectionEnd   ?? el.value.length;
      const before = el.value.slice(0, start);
      const after  = el.value.slice(end);
      el.value = before + text + after;
      const pos = before.length + text.length;
      try { el.setSelectionRange(pos, pos); } catch {}
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    inputs.forEach(el => {
      el.setAttribute('inputmode', 'text');
      el.setAttribute('autocomplete',
        el.id?.toLowerCase().includes('last') ? 'family-name' : 'given-name'
      );

      // Block disallowed chars before they enter the field
      el.addEventListener('beforeinput', (e) => {
        // Ignore deletions/formatting where e.data is null
        if (!e.data) return;
        const cleaned = sanitize(e.data);
        if (cleaned !== e.data) e.preventDefault();
      });

      // Sanitize any remaining junk (IME, autocomplete, programmatic)
      el.addEventListener('input', () => {
        const cleaned = sanitize(el.value);
        if (el.value !== cleaned) {
          const pos = el.selectionStart ?? cleaned.length;
          const delta = el.value.length - cleaned.length;
          el.value = cleaned;
          try {
            el.setSelectionRange(Math.max(0, pos - delta), Math.max(0, pos - delta));
          } catch {}
        }
      });

      // Clean paste
      el.addEventListener('paste', (e) => {
        e.preventDefault();
        const raw = (e.clipboardData || window.clipboardData).getData('text');
        insertAtCursor(el, sanitize(raw));
      });

      // Clean drop
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const raw = e.dataTransfer?.getData('text') ?? '';
        insertAtCursor(el, sanitize(raw));
      });

      // Optional: visible error if digits were somehow present (extra safety)
      el.addEventListener('blur', () => {
        const hasDigit = /\d/.test(el.value);
        el.setCustomValidity(hasDigit ? 'Name cannot contain numbers.' : '');
        // Re-run field validation so UI matches
        validateField(el, { source: 'blur' });
      });
    });
  })();
});
