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

  // ── API base validation ────────────────────────────────────────────────
  // Defence-in-depth: only allow the production API origin or local dev.
  // Any other value (e.g. an attacker-controlled override) is rejected.
  function resolveApiBase(candidate) {
    const fallback = 'https://api.runlog.org';
    const value = candidate || fallback;
    let url;
    try {
      url = new URL(value);
    } catch {
      console.error('runlog: invalid API base URL, refusing fetch:', value);
      return null;
    }
    const isProd = url.protocol === 'https:' && url.host === 'api.runlog.org';
    const isLocal = url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.port !== '';
    if (!isProd && !isLocal) {
      console.error('runlog: API base origin not allowed, refusing fetch:', value);
      return null;
    }
    // Strip any trailing path/query/hash — only origin is meaningful here.
    return url.protocol + '//' + url.host;
  }

  // ── Index page (/register/) ──────────────────────────────────────────────

  function initIndex() {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const apiBase = resolveApiBase(form.dataset.apiBase);
      const submitBtn = form.querySelector('button[type="submit"]');
      const status = document.getElementById('status');

      submitBtn.disabled = true;

      if (apiBase) {
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
    const apiBase = resolveApiBase(window.RUNLOG_API_BASE);

    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      setError(headline, result, 'This link didn\'t work', [
        'No verification token found. Please check the link in your email or ',
        { href: '/register/', text: 'register again' },
        '.',
      ]);
      return;
    }

    if (!apiBase) {
      setError(headline, result, 'Something went wrong', [
        'Configuration error. Please try ',
        { href: '/register/', text: 'registering again' },
        '.',
      ]);
      return;
    }

    let resp;
    try {
      resp = await fetch(`${apiBase}/register/verify?token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.warn('runlog verify fetch error:', err);
      setError(headline, result, 'Something went wrong', [
        'Could not reach the server. Please try ',
        { href: '/register/', text: 'registering again' },
        '.',
      ]);
      return;
    }

    if (resp.ok) {
      let data;
      try {
        data = await resp.json();
      } catch {
        setError(headline, result, 'Something went wrong', [
          'Unexpected response from the server. Please try ',
          { href: '/register/', text: 'registering again' },
          '.',
        ]);
        return;
      }
      renderSuccess(headline, result, data);
      return;
    }

    switch (resp.status) {
      case 400:
        setError(headline, result, 'This link didn\'t work', [
          'The verification token is invalid. Please try ',
          { href: '/register/', text: 'registering again' },
          '.',
        ]);
        break;
      case 404:
        setError(headline, result, 'This link didn\'t work', [
          'This verification link is unknown. Please try ',
          { href: '/register/', text: 'registering again' },
          '.',
        ]);
        break;
      case 410:
        setError(headline, result, 'This link didn\'t work', [
          'This link has already been used. Each verification link can only be used once. ' +
          'If you need your API key again, please ',
          { href: '/register/', text: 'register again' },
          '.',
        ]);
        break;
      case 429:
        setError(headline, result, 'This link didn\'t work',
          'Too many requests. Please wait a moment and try again.');
        break;
      default:
        setError(headline, result, 'Something went wrong', [
          'Please try ',
          { href: '/register/', text: 'registering again' },
          '.',
        ]);
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
    appendParts(docsNote, [
      'Next: add this key to your MCP client config. See the ',
      { href: '/#use-title', text: 'MCP client setup guide' },
      '.',
    ]);

    while (result.firstChild) result.removeChild(result.firstChild);
    result.append(warning, pre, copyBtn, docsNote);
  }

  // setError builds a <p> with safe DOM nodes from `parts`, which is
  // either a plain string or an array whose elements are strings (text)
  // or {href, text} objects (rendered as <a>). Nothing in `parts`
  // is ever interpreted as HTML.
  function setError(headline, result, title, parts) {
    headline.textContent = title;
    const p = document.createElement('p');
    appendParts(p, parts);
    while (result.firstChild) result.removeChild(result.firstChild);
    result.appendChild(p);
  }

  function appendParts(parent, parts) {
    const list = Array.isArray(parts) ? parts : [parts];
    for (const part of list) {
      if (typeof part === 'string') {
        parent.appendChild(document.createTextNode(part));
      } else if (part && typeof part === 'object' && part.href) {
        const a = document.createElement('a');
        a.setAttribute('href', part.href);
        a.textContent = part.text || part.href;
        parent.appendChild(a);
      }
    }
  }
}());
