// emailAutoReply.js
(function () {
  // ⬅️ put your EmailJS IDs here
  const EMAILJS_PUBLIC_KEY  = 'SmP6rTJP04ORTpVg5';
  const EMAILJS_SERVICE_ID  = 'service_6tzmz2d';
  const EMAILJS_TEMPLATE_ID = 'template_6zkfgcq';

  function getStatusEl() {
    // Use existing #status or create one if missing
    let el = document.getElementById('status');
    if (!el) {
      el = document.createElement('p');
      el.id = 'status';
      el.className = 'muted';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function loadEmailJS(cb) {
    if (window.emailjs) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.async = true;
    s.onload = cb;
    document.head.appendChild(s);
  }

  function start() {
    const statusEl = getStatusEl();

    const raw = sessionStorage.getItem('autoReplyPayload');
    if (!raw) { statusEl.textContent = 'No submission details found.'; return; }

    const data = JSON.parse(raw || '{}');
    if (!data.email) {
      sessionStorage.removeItem('autoReplyPayload');
      statusEl.textContent = 'Missing email address.';
      return;
    }

    statusEl.textContent = 'Sending confirmation…';

    loadEmailJS(() => {
      try { emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY }); } catch (e) {}

      const params = {
        to_email:    data.email,
        to_name:     data.to_name || data.first || '',
        first_name:  data.first || '',
        last_name:   data.last  || ''
      };

      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
        .then(() => { statusEl.textContent = 'Confirmation sent. Please check your inbox. Your personalized consultation is on the way'; })
        .catch(err => {
          console.error('[EmailJS] send failed:', err);
          statusEl.textContent = 'We could not send the confirmation email. Please check your spam or try again later.';
        })
        .finally(() => {
          sessionStorage.removeItem('autoReplyPayload');
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
