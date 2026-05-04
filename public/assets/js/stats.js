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

  function setWidth(id, ratio) {
    var el = document.getElementById(id);
    if (el) el.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(1) + "%";
  }

  function setProgress(barId, ratio) {
    var fill = document.getElementById(barId);
    if (!fill) return;
    fill.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(1) + "%";
    var bar = fill.parentNode;
    if (bar && bar.setAttribute) {
      bar.setAttribute("aria-valuenow", Math.round(ratio * 100));
    }
  }

  function formatGeneratedAt(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toUTCString().replace(" GMT", " UTC");
  }

  function renderHeadline(stats) {
    setText("stat-entries-total", stats.entries.total);
    setText("stat-entries-total-2", stats.entries.total);
    setText("stat-entries-verified", stats.entries.verified);
    setText("stat-tags-covered", stats.tags.covered);
    setText("stat-tags-total", stats.tags.total_in_vocabulary);
    setText("stat-users-registered", stats.users.registered);

    var verifiedRatio = stats.entries.total > 0
      ? stats.entries.verified / stats.entries.total
      : 0;
    var tagsRatio = stats.tags.total_in_vocabulary > 0
      ? stats.tags.covered / stats.tags.total_in_vocabulary
      : 0;
    setProgress("stat-verified-fill", verifiedRatio);
    setProgress("stat-tags-fill", tagsRatio);
  }

  function renderByCategory(container, stats) {
    clearChildren(container);

    var sorted = stats.entries.by_category.slice().sort(function (a, b) {
      return b.total - a.total;
    });
    var max = sorted.reduce(function (m, c) { return Math.max(m, c.total); }, 1);

    sorted.forEach(function (cat) {
      var row = document.createElement("div");
      row.className = "stats-row";

      var head = document.createElement("div");
      head.className = "stats-row-head";

      var label = document.createElement("span");
      label.className = "stats-row-label";
      label.textContent = cat.category;
      head.appendChild(label);

      var barWrap = document.createElement("span");
      barWrap.className = "stats-row-bar";
      var fill = document.createElement("span");
      fill.className = "stats-row-fill";
      fill.style.width = ((cat.total / max) * 100).toFixed(1) + "%";
      barWrap.appendChild(fill);
      head.appendChild(barWrap);

      var num = document.createElement("span");
      num.className = "stats-row-num";
      num.textContent = cat.total;
      head.appendChild(num);

      row.appendChild(head);

      if (cat.tags && cat.tags.length) {
        var chips = document.createElement("div");
        chips.className = "stats-tag-chips";
        cat.tags.forEach(function (t) {
          var chip = document.createElement("span");
          chip.className = "stats-chip";
          chip.appendChild(document.createTextNode(t.tag));
          var cnt = document.createElement("span");
          cnt.className = "stats-chip-count";
          cnt.textContent = "·" + t.count;
          chip.appendChild(cnt);
          chips.appendChild(chip);
        });
        row.appendChild(chips);
      }

      container.appendChild(row);
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
    msg.className = "meta";
    msg.textContent = "Stats temporarily unavailable, try again shortly.";
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
