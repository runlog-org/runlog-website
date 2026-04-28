// app.js — registration flow for runlog.org/register
// Vanilla JS, ES2020, no framework, no build step.
// Dispatches on location.pathname: /register/ → index flow, /register/verify → verify flow.

(function () {
  'use strict';

  const path = location.pathname.replace(/\/$/, '');

  if (path.endsWith('/register')) {
    initIndex();
  } else if (path.endsWith('/register/verify')) {
    document.addEventListener('DOMContentLoaded', initVerify);
  }

  // ── Index page (/register/) ──────────────────────────────────────────────

  function initIndex() {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const apiBase = form.dataset.apiBase || 'https://api.runlog.org';
      const submitBtn = form.querySelector('button[type="submit"]');
      const status = document.getElementById('status');

      submitBtn.disabled = true;

      try {
        await fetch(`${apiBase}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch (err) {
        // Network error — swallow; user sees the same message regardless.
        console.warn('runlog register fetch error:', err);
      }

      // Always show the same message to prevent email enumeration.
      status.textContent =
        'If that address is valid, a verification link is on its way. It expires in 1 hour.';
    });
  }

  // ── Verify page (/register/verify) ──────────────────────────────────────

  async function initVerify() {
    const headline = document.getElementById('headline');
    const result = document.getElementById('result');
    const apiBase = window.RUNLOG_API_BASE || 'https://api.runlog.org';

    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      setError(headline, result, 'This link didn\'t work',
        'No verification token found. Please check the link in your email or ' +
        '<a href="/register/">register again</a>.');
      return;
    }

    let resp;
    try {
      resp = await fetch(`${apiBase}/register/verify?token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.warn('runlog verify fetch error:', err);
      setError(headline, result, 'Something went wrong',
        'Could not reach the server. Please try <a href="/register/">registering again</a>.');
      return;
    }

    if (resp.ok) {
      let data;
      try {
        data = await resp.json();
      } catch {
        setError(headline, result, 'Something went wrong',
          'Unexpected response from the server. Please try ' +
          '<a href="/register/">registering again</a>.');
        return;
      }
      renderSuccess(headline, result, data);
      return;
    }

    switch (resp.status) {
      case 400:
        setError(headline, result, 'This link didn\'t work',
          'The verification token is invalid. Please try ' +
          '<a href="/register/">registering again</a>.');
        break;
      case 404:
        setError(headline, result, 'This link didn\'t work',
          'This verification link is unknown. Please try ' +
          '<a href="/register/">registering again</a>.');
        break;
      case 410:
        setError(headline, result, 'This link didn\'t work',
          'This link has already been used. Each verification link can only be used once. ' +
          'If you need your API key again, please <a href="/register/">register again</a>.');
        break;
      case 429:
        setError(headline, result, 'This link didn\'t work',
          'Too many requests. Please wait a moment and try again.');
        break;
      default:
        setError(headline, result, 'Something went wrong',
          'Please try <a href="/register/">registering again</a>.');
    }
  }

  function renderSuccess(headline, result, data) {
    headline.textContent = 'Welcome — here is your API key';

    const warning = document.createElement('p');
    warning.textContent =
      'This is the only time your key will be shown. Copy it now and store it somewhere safe.';

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.id = 'api-key';
    code.textContent = data.api_key || '';
    pre.appendChild(code);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code.textContent).then(() => {
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });

    const docsNote = document.createElement('p');
    docsNote.innerHTML =
      'Next: add this key to your MCP client config. See the ' +
      '<a href="/#use-title">MCP client setup guide</a>.';

    result.innerHTML = '';
    result.append(warning, pre, copyBtn, docsNote);
  }

  function setError(headline, result, title, html) {
    headline.textContent = title;
    result.innerHTML = `<p>${html}</p>`;
  }
}());
