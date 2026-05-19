// account-app.js — account flow for runlog.org (login, verify, dashboard)
// Vanilla JS, ES2020, no framework, no build step.
// Dispatches on location.pathname: /login → login flow.

(function () {
  'use strict';

  const path = location.pathname.replace(/\/$/, '');

  if (path.endsWith('/login')) {
    initLogin();
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
