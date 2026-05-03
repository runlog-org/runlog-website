// Hydrate the homepage "By the numbers" callout and the /stats/ page from
// /stats.json. Fail closed on the homepage (callout stays hidden); on
// /stats/ replace the body with a "temporarily unavailable" line.
//
// Uses textContent + DOM construction APIs only — no innerHTML assignment
// anywhere in this file. If you find yourself reaching for innerHTML,
// build the element tree with createElement / appendChild instead.

(function () {
  "use strict";

  var STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function formatGeneratedAt(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toUTCString().replace(" GMT", " UTC");
  }

  function renderHeadline(stats) {
    setText("stat-entries-total", stats.entries.total);
    setText("stat-entries-verified", stats.entries.verified);
    setText("stat-tags-covered", stats.tags.covered);
    setText("stat-tags-total", stats.tags.total_in_vocabulary);
    setText("stat-users-registered", stats.users.registered);
  }

  function renderByCategory(container, stats) {
    clearChildren(container);
    stats.entries.by_category.forEach(function (cat) {
      var section = document.createElement("section");
      section.className = "stats-category";

      var heading = document.createElement("h3");
      heading.textContent =
        cat.category.charAt(0).toUpperCase() +
        cat.category.slice(1) +
        " — " +
        cat.total +
        " entries";
      section.appendChild(heading);

      var line = document.createElement("p");
      line.className = "stats-tags";
      line.textContent = cat.tags
        .map(function (t) {
          return t.tag + " (" + t.count + ")";
        })
        .join(" · "); // middle dot
      section.appendChild(line);

      container.appendChild(section);
    });
  }

  function renderGeneratedAt(stats) {
    var el = document.getElementById("stat-generated-at");
    if (!el) return;
    var iso = stats.generated_at;
    var d = new Date(iso);
    var stale =
      isFinite(d.getTime()) && Date.now() - d.getTime() > STALE_THRESHOLD_MS;
    el.textContent = (stale ? "stale — " : "") + formatGeneratedAt(iso);
  }

  function showOnStatsPageError() {
    var page = document.getElementById("stats-page-body");
    if (!page) return;
    clearChildren(page);
    var msg = document.createElement("p");
    msg.className = "note";
    msg.textContent =
      "Stats temporarily unavailable — try again shortly.";
    page.appendChild(msg);
  }

  function showHomepageCallout() {
    var callout = document.getElementById("stats-callout");
    if (callout) callout.removeAttribute("hidden");
  }

  fetch("/stats.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (stats) {
      renderHeadline(stats);
      var byCat = document.getElementById("stat-by-category");
      if (byCat) {
        renderByCategory(byCat, stats);
        renderGeneratedAt(stats);
      }
      showHomepageCallout();
    })
    .catch(function () {
      showOnStatsPageError();
      // Homepage callout stays hidden — fail closed.
    });
})();
