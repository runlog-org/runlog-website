// app.js — registration flow for runlog.org/register
// Vanilla JS, ES2020, no framework, no build step.
// Dispatches on location.pathname: /register/ → index flow, /register/verify → verify flow.

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────
  // How long the copy button stays in the "Copied" state after a click.
  const COPY_FEEDBACK_MS = 1500;

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

  // ── Info-box rendering ─────────────────────────────────────────────────
  // Inline-SVG icon paths (Heroicons-derived, public-domain shapes).
  // SVGs are inline so no extra fetch and so they pick up CSS color via
  // `fill="currentColor"`. They are aria-hidden — the variant + body text
  // already convey meaning to assistive tech.
  const INFO_BOX_ICON_PATHS = {
    success: 'M16.704 5.29a1 1 0 0 1 0 1.42l-7.99 7.99a1 1 0 0 1-1.42 0L3.296 10.7a1 1 0 1 1 1.42-1.42l3.286 3.286 7.282-7.276a1 1 0 0 1 1.42 0z',
    warn:    'M9.401 2.293a1.5 1.5 0 0 1 2.598 0l7.5 12.99A1.5 1.5 0 0 1 18.2 17.5H3.8a1.5 1.5 0 0 1-1.299-2.217l7.5-12.99zM10 7.5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 7.5zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z',
    error:   'M9.401 2.293a1.5 1.5 0 0 1 2.598 0l7.5 12.99A1.5 1.5 0 0 1 18.2 17.5H3.8a1.5 1.5 0 0 1-1.299-2.217l7.5-12.99zM10 7.5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 10 7.5zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z',
    info:    'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm.75 4.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zM10 8.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 10 8.5z',
  };

  // buildInfoBox returns a <div class="info-box info-box--{variant}">
  // with an inline SVG icon followed by an .info-box__body containing
  // `parts` rendered via appendParts. `variant` is one of
  // 'success' | 'warn' | 'error' | 'info'.
  function buildInfoBox(variant, parts) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const box = document.createElement('div');
    box.className = 'info-box info-box--' + variant;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'info-box__icon');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(SVG_NS, 'path');
    const iconKey = INFO_BOX_ICON_PATHS[variant] ? variant : 'info';
    path.setAttribute('d', INFO_BOX_ICON_PATHS[iconKey]);
    svg.appendChild(path);

    const body = document.createElement('div');
    body.className = 'info-box__body';
    appendParts(body, parts);

    box.append(svg, body);
    return box;
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

      let fetchFailed = false;
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
          fetchFailed = true;
        }
      }

      // Always show the same message to prevent email enumeration.
      // The text is byte-identical regardless of input validity — the
      // server returns the same response either way and we mustn't leak
      // success-vs-failure via DOM differences.
      const statusBox = buildInfoBox('success', [
        'If that address is valid, a verification link is on its way. It expires in 1 hour.',
      ]);
      while (status.firstChild) status.removeChild(status.firstChild);
      status.appendChild(statusBox);

      // Re-enable the button on network failure so the user can retry.
      // On success the same anti-enumeration message is shown either way,
      // but a frozen form on a real network blip is worse than letting them
      // press send again.
      if (fetchFailed) {
        submitBtn.disabled = false;
      }
    });
  }

  // ── Verify page (/register/verify) ──────────────────────────────────────

  async function initVerify() {
    const headline = document.getElementById('headline');
    const result = document.getElementById('result');
    const host = document.querySelector('[data-api-base]');
    const apiBase = resolveApiBase(host && host.dataset.apiBase);

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

    // The "store this now" warning is store-it-or-lose-it advice — it's
    // a positive outcome but still cautionary, so the warn (amber) variant
    // fits its content better than success (green). The <pre>/copy/docs
    // flow stays outside the box so the existing copy-button semantics
    // are unchanged.
    const warningBox = buildInfoBox('warn', [
      'This is the only time your key will be shown. Copy it now and store it somewhere safe.',
    ]);

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.id = 'api-key';
    code.textContent = data.api_key || '';
    pre.appendChild(code);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy API key to clipboard');
    // aria-live on the button itself so screen readers announce the
    // "Copy" → "Copied" transition without needing a separate live region.
    copyBtn.setAttribute('aria-live', 'polite');
    let copyResetTimer = null;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code.textContent).then(() => {
        copyBtn.textContent = 'Copied';
        // Cancel any pending reset from a prior click so rapid clicks
        // don't race the label back to "Copy" mid-feedback.
        if (copyResetTimer !== null) clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyResetTimer = null;
        }, COPY_FEEDBACK_MS);
      });
    });

    const docsNote = document.createElement('p');
    appendParts(docsNote, [
      'Next: add this key to your MCP client config. See the ',
      { href: '/#use-title', text: 'MCP client setup guide' },
      '.',
    ]);

    while (result.firstChild) result.removeChild(result.firstChild);
    result.append(warningBox, pre, copyBtn, docsNote);
  }

  // setError builds an info-box--error with safe DOM nodes from `parts`,
  // which is either a plain string or an array whose elements are
  // strings (text) or {href, text} objects (rendered as <a>). Nothing
  // in `parts` is ever interpreted as HTML.
  function setError(headline, result, title, parts) {
    headline.textContent = title;
    const box = buildInfoBox('error', parts);
    while (result.firstChild) result.removeChild(result.firstChild);
    result.appendChild(box);
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
