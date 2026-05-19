// account-app.js — account flow for runlog.org (login, verify, dashboard)
// Vanilla JS, ES2020, no framework, no build step.
// Dispatches on location.pathname: /login → login flow, /login/verify → verify flow.

(function () {
  'use strict';

  const path = location.pathname.replace(/\/$/, '');

  if (path.endsWith('/login')) {
    initLogin();
  }

  if (path.endsWith('/login/verify')) {
    document.addEventListener('DOMContentLoaded', initLoginVerify);
  }

  if (path.endsWith('/account')) {
    document.addEventListener('DOMContentLoaded', initAccount);
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

  // ── Login page (/login) ────────────────────────────────────────────────

  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // Turnstile callbacks — globals because Turnstile invokes them by name from data-* attrs.
    window.onTurnstileSuccess = function () {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    };
    window.onTurnstileError = function () {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
    };
    window.onTurnstileExpired = function () {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const apiBase = resolveApiBase(form.dataset.apiBase);
      const submitBtn = form.querySelector('button[type="submit"]');
      const status = document.getElementById('status');

      submitBtn.disabled = true;

      // Read Turnstile token if the widget has completed. Empty string is intentional:
      // the server returns the same anti-enumeration response either way; we do NOT
      // short-circuit or show an error to the user — that would leak challenge-pass/fail state.
      const turnstileToken = window.turnstile && typeof window.turnstile.getResponse === 'function'
        ? window.turnstile.getResponse() || ''
        : '';

      let fetchFailed = false;
      if (apiBase) {
        try {
          await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, turnstile_token: turnstileToken }),
          });
        } catch (err) {
          // Network error — swallow; user sees the same message regardless.
          console.warn('runlog login fetch error:', err);
          fetchFailed = true;
        }
      }

      // Always show the same message to prevent email enumeration.
      // The text is byte-identical regardless of whether the email is known —
      // the server returns the same response either way and we mustn't leak
      // success-vs-failure via DOM differences.
      const statusBox = buildInfoBox('success', [
        'Check your inbox — if that email has an account, a sign-in link is on its way. The link is valid for about an hour.',
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

  // ── Login verify page (/login/verify) ────────────────────────────────────

  function initLoginVerify() {
    const btn = document.getElementById('confirm-btn');
    const status = document.getElementById('status');
    const host = document.querySelector('[data-api-base]');
    const apiBase = resolveApiBase(host && host.dataset.apiBase);

    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      showStatus(buildInfoBox('error', [
        'No sign-in token found. Please check the link in your email or ',
        { href: '/login/', text: 'request a new sign-in link' },
        '.',
      ]));
      if (btn) btn.disabled = true;
      return;
    }

    if (!apiBase) {
      showStatus(buildInfoBox('error', [
        'Configuration error. Please try ',
        { href: '/login/', text: 'signing in again' },
        '.',
      ]));
      if (btn) btn.disabled = true;
      return;
    }

    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;

      let resp;
      try {
        resp = await fetch(`${apiBase}/auth/login/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch (err) {
        console.warn('runlog login/verify fetch error:', err);
        showStatus(buildInfoBox('error', [
          'Could not reach the server. Please try ',
          { href: '/login/', text: 'signing in again' },
          '.',
        ]));
        btn.disabled = false;
        return;
      }

      if (resp.ok) {
        showStatus(buildInfoBox('success', [
          'You\'re signed in. Taking you to your account…',
        ]));
        window.location.assign('/account/');
        return;
      }

      let errType = '';
      try {
        const body = await resp.json();
        errType = (body && body.error && body.error.type) || '';
      } catch {
        // ignore parse failure; fall through to status-based messages
      }

      switch (resp.status) {
        case 404:
          showStatus(buildInfoBox('error', [
            'This sign-in link is not recognised. Please try ',
            { href: '/login/', text: 'requesting a new one' },
            '.',
          ]));
          break;
        case 410:
          showStatus(buildInfoBox('error', [
            'This link has already been used or has expired. Each sign-in link can only be used once. Please ',
            { href: '/login/', text: 'request a new sign-in link' },
            '.',
          ]));
          break;
        case 429:
          showStatus(buildInfoBox('warn', [
            'Too many requests. Please wait a moment and try again.',
          ]));
          btn.disabled = false;
          break;
        default:
          showStatus(buildInfoBox('error', [
            'Something went wrong. Please try ',
            { href: '/login/', text: 'signing in again' },
            '.',
          ]));
      }

      void errType; // consumed for future fine-grained messages
    });

    function showStatus(node) {
      while (status.firstChild) status.removeChild(status.firstChild);
      status.appendChild(node);
    }
  }

  // ── Account dashboard (/account) ──────────────────────────────────────

  async function initAccount() {
    const host = document.querySelector('[data-api-base]');
    const apiBase = resolveApiBase(host && host.dataset.apiBase);

    const status        = document.getElementById('status');
    const keysSection   = document.getElementById('keys-section');
    const keysList      = document.getElementById('keys-list');
    const createKeyBtn  = document.getElementById('create-key-btn');
    const keysStatus    = document.getElementById('keys-status');
    const statsSection  = document.getElementById('stats-section');
    const statsPanel    = document.getElementById('stats-panel');
    const logoutBtn     = document.getElementById('logout-btn');
    const deleteSection = document.getElementById('delete-section');
    const deleteInput   = document.getElementById('delete-email-input');
    const deleteBtn     = document.getElementById('delete-account-btn');
    const deleteStatus  = document.getElementById('delete-status');

    // Hide everything until session is confirmed.
    if (keysSection)   keysSection.hidden   = true;
    if (statsSection)  statsSection.hidden  = true;
    if (logoutBtn)     logoutBtn.hidden     = true;
    if (deleteSection) deleteSection.hidden = true;

    if (!apiBase) {
      setBox(status, buildInfoBox('error', [
        'Configuration error. Please try ',
        { href: '/login/', text: 'signing in again' },
        '.',
      ]));
      return;
    }

    // ── Session probe (read-only) ─────────────────────────────────────────
    let sessionData;
    try {
      const resp = await fetch(`${apiBase}/account`, {
        method: 'GET',
        credentials: 'include',
      });

      if (resp.status === 401 || resp.status === 403) {
        window.location.assign('/login/');
        return;
      }

      if (!resp.ok) {
        setBox(status, buildInfoBox('error', [
          'Could not load your account. Please try ',
          { href: '/login/', text: 'signing in again' },
          '.',
        ]));
        return;
      }

      try {
        sessionData = await resp.json();
      } catch {
        sessionData = {};
      }
    } catch (err) {
      console.warn('runlog account probe error:', err);
      setBox(status, buildInfoBox('error', [
        'Could not reach the server. Please try ',
        { href: '/login/', text: 'signing in again' },
        '.',
      ]));
      return;
    }

    // Email for the delete-account gate: prefer probe response, fall back to null.
    const accountEmail = (sessionData && sessionData.email) || null;

    // Session confirmed — reveal the sections.
    if (keysSection)   keysSection.hidden   = false;
    if (statsSection)  statsSection.hidden  = false;
    if (logoutBtn)     logoutBtn.hidden     = false;
    if (deleteSection) deleteSection.hidden = false;

    // ── Keys (T3) ─────────────────────────────────────────────────────────
    await renderKeys(apiBase, keysList, keysStatus);

    if (createKeyBtn) {
      createKeyBtn.addEventListener('click', async () => {
        createKeyBtn.disabled = true;
        setBox(keysStatus, null);

        let resp;
        try {
          resp = await fetch(`${apiBase}/account/keys`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
        } catch (err) {
          console.warn('runlog create key error:', err);
          setBox(keysStatus, buildInfoBox('error', [
            'Could not reach the server. Please try again.',
          ]));
          createKeyBtn.disabled = false;
          return;
        }

        if (!resp.ok) {
          const errMsg = await extractErrorMessage(resp);
          setBox(keysStatus, buildInfoBox('error', [
            errMsg || 'Could not create key. Please try again.',
          ]));
          createKeyBtn.disabled = false;
          return;
        }

        let data;
        try {
          data = await resp.json();
        } catch {
          data = {};
        }

        // If the server returns the raw key value, show it once with a
        // copy affordance (it will not be retrievable again).
        const rawKey = data && (data.key || data.api_key || data.value);
        if (rawKey) {
          const keyBox = buildNewKeyBox(rawKey);
          setBox(keysStatus, keyBox);
        } else {
          setBox(keysStatus, buildInfoBox('success', ['Key created.']));
        }

        await renderKeys(apiBase, keysList, keysStatus);
        createKeyBtn.disabled = false;
      });
    }

    // ── Stats (T4) ────────────────────────────────────────────────────────
    await renderStats(apiBase, statsPanel);

    // ── Logout (T4) ───────────────────────────────────────────────────────
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        try {
          await fetch(`${apiBase}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (err) {
          console.warn('runlog logout error:', err);
          // Best-effort; redirect regardless.
        }
        window.location.assign('/login/');
      });
    }

    // ── Delete account (T5) ───────────────────────────────────────────────
    if (deleteInput && deleteBtn) {
      deleteInput.addEventListener('input', () => {
        const val = deleteInput.value.trim();
        if (accountEmail) {
          // Exact-match against the probe's email when available.
          deleteBtn.disabled = (val !== accountEmail);
        } else {
          // Fallback: gate on a non-empty, plausibly-shaped email.
          deleteBtn.disabled = !(val.length > 0 && val.includes('@'));
        }
      });

      deleteBtn.addEventListener('click', async () => {
        deleteBtn.disabled = true;
        setBox(deleteStatus, null);

        let resp;
        try {
          resp = await fetch(`${apiBase}/account`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm_email: deleteInput.value.trim() }),
          });
        } catch (err) {
          console.warn('runlog delete account error:', err);
          setBox(deleteStatus, buildInfoBox('error', [
            'Could not reach the server. Please try again.',
          ]));
          deleteBtn.disabled = false;
          return;
        }

        if (resp.ok) {
          setBox(deleteStatus, buildInfoBox('success', [
            'Your account has been deleted. Submitted findings are retained under ' +
            'an anonymous identifier. Taking you to the sign-in page…',
          ]));
          setTimeout(() => window.location.assign('/login/'), 3000);
          return;
        }

        const errMsg = await extractErrorMessage(resp);
        setBox(deleteStatus, buildInfoBox('error', [
          errMsg || 'Could not delete account. Please try again.',
        ]));
        // Re-enable only if the email input still matches (avoids re-enabling
        // after a wrong-email 4xx when accountEmail is available).
        const val = deleteInput.value.trim();
        const stillMatches = accountEmail
          ? val === accountEmail
          : (val.length > 0 && val.includes('@'));
        deleteBtn.disabled = !stillMatches;
      });
    }
  }

  // Fetch and render the keys list into `container`.
  // Errors are silently swallowed — a missing list is not fatal.
  async function renderKeys(apiBase, container, statusEl) {
    if (!container) return;

    let keys;
    try {
      const resp = await fetch(`${apiBase}/account/keys`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) {
        container.textContent = '';
        return;
      }
      const data = await resp.json();
      // Accept both {keys: [...]} and a bare array.
      keys = Array.isArray(data) ? data : (data && Array.isArray(data.keys) ? data.keys : []);
    } catch (err) {
      console.warn('runlog keys list error:', err);
      return;
    }

    container.textContent = '';

    if (!keys.length) {
      const p = document.createElement('p');
      p.textContent = 'No active keys.';
      container.appendChild(p);
      return;
    }

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';

    for (const key of keys) {
      // Skip soft-deleted keys (deleted_at present and non-null).
      if (key && key.deleted_at) continue;

      const li = document.createElement('li');
      li.style.marginBottom = 'var(--space-3)';

      const idSpan = document.createElement('code');
      idSpan.textContent = (key && key.id) || '—';

      const meta = document.createElement('span');
      meta.style.color = 'var(--color-muted)';
      meta.style.fontSize = '0.875rem';
      meta.style.marginLeft = 'var(--space-3)';
      const parts = [];
      if (key && key.created_at) parts.push('Created ' + formatDate(key.created_at));
      if (key && key.last_used_at) parts.push('Last used ' + formatDate(key.last_used_at));
      meta.textContent = parts.join(' · ');

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Revoke';
      delBtn.type = 'button';
      delBtn.style.marginLeft = 'var(--space-3)';
      delBtn.style.fontSize = '0.875rem';
      delBtn.style.padding = '0.1rem 0.6rem';
      delBtn.className = 'form-button';
      delBtn.setAttribute('aria-label', 'Revoke key ' + ((key && key.id) || ''));
      delBtn.addEventListener('click', async () => {
        delBtn.disabled = true;
        try {
          const resp = await fetch(`${apiBase}/account/keys/${encodeURIComponent(key.id)}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (resp.ok) {
            li.remove();
            if (statusEl) setBox(statusEl, buildInfoBox('success', ['Key revoked.']));
          } else {
            const errMsg = await extractErrorMessage(resp);
            if (statusEl) setBox(statusEl, buildInfoBox('error', [
              errMsg || 'Could not revoke key. Please try again.',
            ]));
            delBtn.disabled = false;
          }
        } catch (err) {
          console.warn('runlog revoke key error:', err);
          if (statusEl) setBox(statusEl, buildInfoBox('error', [
            'Could not reach the server. Please try again.',
          ]));
          delBtn.disabled = false;
        }
      });

      li.append(idSpan, meta, delBtn);
      ul.appendChild(li);
    }

    // If every key was soft-deleted, the list is empty.
    if (!ul.children.length) {
      const p = document.createElement('p');
      p.textContent = 'No active keys.';
      container.appendChild(p);
      return;
    }

    container.appendChild(ul);
  }

  // Fetch and render stats into `panel`.
  async function renderStats(apiBase, panel) {
    if (!panel) return;

    let data;
    try {
      const resp = await fetch(`${apiBase}/account/stats`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return;
      data = await resp.json();
    } catch (err) {
      console.warn('runlog stats error:', err);
      return;
    }

    if (!data || typeof data !== 'object') return;

    // Render whatever fields are present — tolerant to shape changes.
    const dl = document.createElement('dl');
    dl.className = 'diff-list';

    for (const [rawKey, val] of Object.entries(data)) {
      if (val === null || val === undefined) continue;
      const dt = document.createElement('dt');
      dt.textContent = labelify(rawKey);
      const dd = document.createElement('dd');
      dd.textContent = String(val);
      dl.append(dt, dd);
    }

    if (!dl.children.length) {
      panel.textContent = 'No stats available.';
      return;
    }

    panel.appendChild(dl);
  }

  // Build a "store this now" box for a freshly minted key.
  // Mirrors the pattern in register-app.js renderSuccess.
  const COPY_FEEDBACK_MS = 1500;

  function buildNewKeyBox(rawKey) {
    const COPY_FEEDBACK_LOCAL = COPY_FEEDBACK_MS;
    const wrapper = document.createElement('div');

    const warn = buildInfoBox('warn', [
      'This is the only time this key will be shown. Copy it now and store it somewhere safe.',
    ]);

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = rawKey;
    pre.appendChild(code);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'form-button';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy API key to clipboard');
    copyBtn.setAttribute('aria-live', 'polite');
    let copyResetTimer = null;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code.textContent).then(() => {
        copyBtn.textContent = 'Copied';
        if (copyResetTimer !== null) clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyResetTimer = null;
        }, COPY_FEEDBACK_LOCAL);
      });
    });

    wrapper.append(warn, pre, copyBtn);
    return wrapper;
  }

  // Replace all children of `el` with `node`, or clear if node is null.
  function setBox(el, node) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (node) el.appendChild(node);
  }

  // Extract a human-readable error message from the nested error envelope
  // {"error":{"type":"...","message":"..."}} or fall back to null.
  async function extractErrorMessage(resp) {
    try {
      const body = await resp.json();
      return (body && body.error && body.error.message) || null;
    } catch {
      return null;
    }
  }

  // Format an ISO date string as a short locale date, or return the raw string.
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  // Convert a snake_case or camelCase field name to a readable label.
  function labelify(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^\w/, (c) => c.toUpperCase());
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
