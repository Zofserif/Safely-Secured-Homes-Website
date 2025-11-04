(function () {
  // ---- decode helpers ----
  function tryJSON(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }
  function readFromHash() {
    const m = (location.hash || "").match(/(?:^|#|&)\s*p=([^&]+)/i);
    if (!m) return null;
    try {
      const json = decodeURIComponent(atob(m[1]));
      return tryJSON(json);
    } catch { return null; }
  }
  function readPayload() {
    // 1) URL hash (most reliable across export/new tabs)
    let p = readFromHash();
    if (p) return p;

    // 2) sessionStorage (same-tab navigations)
    const s = sessionStorage.getItem("autoReplyPayload");
    p = s && tryJSON(s);
    if (p) return p;

    // 3) localStorage (backup)
    const l = localStorage.getItem("autoReplyPayload");
    p = l && tryJSON(l);
    return p || {};
  }

  // ---- data pickers ----
  function pickFirstName(p) {
    const direct =
      (p.first && String(p.first).trim()) ||
      (p.firstname && String(p.firstname).trim()) ||
      (p.first_name && String(p.first_name).trim());
    if (direct) return direct;
    const name = (p.to_name || "").trim();
    return name ? (name.split(/\s+/)[0] || "") : "";
  }
  function parseIntSafe(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  function pickNumbers(p) {
    return {
      cam: parseIntSafe(p.cameraCount),
      nvr: parseIntSafe(p.nvrChannel),
    };
  }
  function pickLocations(p, fallbackCount) {
    let locs = [];
    if (Array.isArray(p.cameraRecommendedLocations)) {
      locs = p.cameraRecommendedLocations.slice();
    } else if (typeof p.cameraRecommendedLocations === "string") {
      locs = p.cameraRecommendedLocations.split(/[\n,;]+/);
    } else if (typeof p.camera_locations === "string") {
      locs = p.camera_locations.split(/[\n,;]+/);
    }
    // tidy & dedupe
    locs = [...new Set(locs.map(s => String(s).trim()).filter(Boolean))];

    if (!locs.length) {
      const defaults = [
        "Front door / porch",
        "Back door / patio",
        "Driveway / garage",
        "Side gate / alley",
        "Living room (main entry view)",
        "Stair landing / hallway",
      ];
      const take = Math.min(defaults.length, Math.max(2, fallbackCount || 4));
      locs = defaults.slice(0, take);
    }
    return locs;
  }

  // ---- renderers ----
  function renderName(first) {
    const el = document.getElementById("jsFirstName");
    if (el) el.textContent = first || "there";
  }
  function renderNumbers(cam, nvr) {
    const camEl = document.getElementById("jsCamCount");
    const nvrEl = document.getElementById("jsNvrChannel");
    if (camEl) camEl.textContent = cam != null ? cam : "—";
    if (nvrEl) nvrEl.textContent = nvr != null ? nvr : "—";
  }
  function renderLocations(list) {
    const wrap = document.getElementById("jsCamLocationsWrap");
    const ul = document.getElementById("jsCamLocations");
    if (!ul) return;
    ul.innerHTML = "";
    list.forEach(txt => {
      const li = document.createElement("li");
      li.textContent = txt;
      ul.appendChild(li);
    });
    if (wrap) wrap.hidden = list.length === 0;
  }

  function run() {
    const p = readPayload();
    const first = pickFirstName(p);
    const { cam, nvr } = pickNumbers(p);
    const locs = pickLocations(p, cam);

    renderName(first);
    renderNumbers(cam, nvr);
    renderLocations(locs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
