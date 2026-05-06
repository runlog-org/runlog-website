// findings-app.js — runtime for runlog.org/findings/.
// Vanilla JS, ES2020, no framework, no build step. On page load,
// fetches the public /v1/findings/recent endpoint, then either
// populates #findings-list with up to 5 cards or reveals
// #findings-empty for the friendly empty-state. Any non-200 / network
// failure also falls through to the empty-state.

(function () {
  'use strict';

  const API_BASE = 'https://api.runlog.org';

  // Inline-SVG path for the success-variant info-box icon. Copied
  // verbatim from public/assets/js/register-app.js (Heroicons-derived
  // public-domain check shape) so the visual language matches F50.
  const CHECK_PATH_D =
    'M16.704 5.29a1 1 0 0 1 0 1.42l-7.99 7.99a1 1 0 0 1-1.42 0L3.296 10.7a1 1 0 1 1 1.42-1.42l3.286 3.286 7.282-7.276a1 1 0 0 1 1.42 0z';

  // ── Wire fetch ─────────────────────────────────────────────────────────
  // Returns { findings: [], as_of: null } on any non-200 / shape error /
  // network failure. Never throws to the caller.
  async function fetchRecentFindings() {
    try {
      const resp = await fetch(`${API_BASE}/v1/findings/recent`);
      if (!resp.ok) {
        console.warn(`[runlog] /v1/findings/recent returned ${resp.status}`);
        return { findings: [], as_of: null };
      }
      const body = await resp.json();
      if (!body || !Array.isArray(body.findings)) {
        console.warn('[runlog] /v1/findings/recent returned unexpected body shape');
        return { findings: [], as_of: null };
      }
      return body;
    } catch (err) {
      console.warn('[runlog] /v1/findings/recent fetch error:', err);
      return { findings: [], as_of: null };
    }
  }

  // ── Relative-time formatter ────────────────────────────────────────────
  // Returns a short string like "3 days ago" / "just now" for an ISO
  // timestamp. Null / invalid → empty string (caller hides the line).
  function formatRelativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffMs = Date.now() - then;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
    const month = Math.floor(day / 30);
    if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
    const year = Math.floor(day / 365);
    return `${year} year${year === 1 ? '' : 's'} ago`;
  }

  // ── DOM construction ───────────────────────────────────────────────────
  // Builds an <article class="info-box info-box--success finding-card">
  // styled by the .finding-card rules in global.css. Uses createElement /
  // textContent throughout — innerHTML is only used for the inline SVG
  // icon, which is a hardcoded constant (no untrusted input).
  function buildFindingCard(f) {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const article = document.createElement('article');
    article.className = 'info-box info-box--success finding-card';
    if (f.unit_id) article.dataset.unitId = f.unit_id;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'info-box__icon');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', CHECK_PATH_D);
    svg.appendChild(path);
    article.appendChild(svg);

    const body = document.createElement('div');
    body.className = 'info-box__body';

    const h3 = document.createElement('h3');
    h3.className = 'finding-card__title';
    h3.textContent = f.title || '';
    body.appendChild(h3);

    if (Array.isArray(f.domain) && f.domain.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'finding-card__domains';
      ul.setAttribute('aria-label', 'Domain tags');
      for (const d of f.domain) {
        const li = document.createElement('li');
        li.className = 'domain-pill';
        li.textContent = String(d);
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }

    const relTime = formatRelativeTime(f.last_confirmed_at);
    if (relTime) {
      const p = document.createElement('p');
      p.className = 'finding-card__time';
      const status = document.createElement('span');
      status.className = 'finding-card__status';
      status.textContent = f.status || '';
      p.appendChild(status);
      p.appendChild(document.createTextNode(' · '));
      const time = document.createElement('time');
      time.setAttribute('datetime', f.last_confirmed_at || '');
      time.textContent = relTime;
      p.appendChild(time);
      body.appendChild(p);
    }

    article.appendChild(body);
    return article;
  }

  // ── Page bootstrap ─────────────────────────────────────────────────────
  // Runs only on the /findings/ page (where #findings-list exists). The
  // script is loaded with `defer`, so the DOM is ready by the time we
  // execute, but we still guard on element presence.
  function init() {
    const list = document.getElementById('findings-list');
    const emptyState = document.getElementById('findings-empty');
    if (!list || !emptyState) return;

    fetchRecentFindings().then(({ findings }) => {
      list.setAttribute('aria-busy', 'false');
      if (!findings || findings.length === 0) {
        list.hidden = true;
        emptyState.hidden = false;
        return;
      }
      for (const f of findings) {
        const li = document.createElement('li');
        li.appendChild(buildFindingCard(f));
        list.appendChild(li);
      }
    });
  }

  init();
}());
