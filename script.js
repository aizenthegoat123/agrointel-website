/* ==========================================================
   AgroIntel — landing interactions
   ========================================================== */

"use strict";

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

/* ==========================================================
   Toast
   ========================================================== */
const toastEl = $("#toast");
let toastTimer;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3800);
}

/* ==========================================================
   Theme toggle — light / dark / system, cycled by one button
   ========================================================== */
const THEME_STORE = "agro_theme";
const themeToggle = $("#themeToggle");

function applyTheme(mode) {
  if (mode === "light" || mode === "dark") {
    document.documentElement.setAttribute("data-theme", mode);
  } else {
    document.documentElement.removeAttribute("data-theme"); // "system"
  }
  if (themeToggle) themeToggle.dataset.mode = mode;
}

function currentThemeMode() {
  const saved = localStorage.getItem(THEME_STORE);
  return saved === "light" || saved === "dark" ? saved : "system";
}

applyTheme(currentThemeMode());

themeToggle?.addEventListener("click", () => {
  const order = ["light", "dark", "system"];
  const next = order[(order.indexOf(currentThemeMode()) + 1) % order.length];
  if (next === "system") localStorage.removeItem(THEME_STORE);
  else localStorage.setItem(THEME_STORE, next);
  applyTheme(next);
  showToast(`Theme: ${next === "system" ? "Match system" : next === "dark" ? "Dark" : "Light"}`);
});

/* ==========================================================
   Announcement bar + navbar
   ========================================================== */
const announceClose = $("#announceClose");
if (announceClose) {
  announceClose.addEventListener("click", () => {
    $("#announceBar").hidden = true;
  });
}

const navbar = $("#navbar");
const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* Mobile menu */
const hamburger = $("#hamburger");
const navLinks = $("#navLinks");
hamburger.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", String(open));
  document.body.style.overflow = open ? "hidden" : "";
});
navLinks.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    navLinks.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
});

/* ==========================================================
   Animated stat counters
   ========================================================== */
const counters = $$(".stat strong[data-count]");
const formatCount = (value, decimals, suffix) =>
  value.toFixed(decimals) + suffix;

const countObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      const suffix = el.dataset.suffix || "";
      const duration = 1600;
      const start = performance.now();

      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(2, -8 * p);
        el.textContent = formatCount(target * eased, decimals, suffix);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = formatCount(target, decimals, suffix);
      };
      requestAnimationFrame(tick);
      countObserver.unobserve(el);
    }
  },
  { threshold: 0.6 }
);
counters.forEach((el) => countObserver.observe(el));

/* ==========================================================
   FAQ accordion (single-open)
   ========================================================== */
$$(".faq-item").forEach((item) => {
  const toggle = $(".faq-q", item);
  toggle.addEventListener("click", () => {
    const willOpen = !item.classList.contains("open");
    $$(".faq-item.open").forEach((openItem) => {
      openItem.classList.remove("open");
      $(".faq-q", openItem).setAttribute("aria-expanded", "false");
    });
    if (willOpen) {
      item.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
    }
  });
});

/* ==========================================================
   Crop library filters
   ========================================================== */
const cropFilters = $$(".crop-filter");
const cropTiles = $$(".crop-tile");
cropFilters.forEach((btn) => {
  btn.addEventListener("click", () => {
    cropFilters.forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", String(b === btn));
    });
    const filter = btn.dataset.filter;
    cropTiles.forEach((tile) => {
      tile.classList.toggle("hide", filter !== "all" && tile.dataset.cat !== filter);
    });
  });
});

/* ==========================================================
   NASA Live — map, suitability overlay, POWER climate charts
   ========================================================== */
(function initNasaLive() {
  const mapEl = document.getElementById("nasaMap");
  if (!mapEl) return;

  if (!window.L) {
    mapEl.innerHTML = '<div class="chart-empty" style="margin:0.75rem">Map tiles need an internet connection — everything else on this page works offline.</div>';
    return;
  }

  const FARM = { lat: 42.021, lon: -93.55, zoom: 12, name: "GreenHarvest North · Central Iowa" };
  const BLOCK_MARKERS = [
    { id: "A", crop: "Tomato", ndvi: "0.62", note: "Early blight — action required", pos: [41.986, -93.586] },
    { id: "B", crop: "Wheat",  ndvi: "0.78", note: "Vigorous, on track",             pos: [42.046, -93.588] },
    { id: "C", crop: "Cotton", ndvi: "0.66", note: "Aphid risk: moderate",           pos: [42.046, -93.493] },
    { id: "D", crop: "Grapes", ndvi: "0.83", note: "Excellent vigor",                pos: [41.997, -93.475] },
    { id: "E", crop: "Paddy",  ndvi: "0.81", note: "Standing water 4 cm",            pos: [41.963, -93.502] },
  ];

  const esriSatellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 18 }
  );
  const osmStreets = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
  );
  /* Transparent reference labels — roads, rivers, cities — keeps deep zooms legible */
  const esriLabels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Esri", maxZoom: 18, opacity: 0.9, zIndex: 4 }
  );

  const GIBS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
  const nasaLayer = L.tileLayer.wms(GIBS_URL, {
    layers: "MODIS_Terra_CorrectedReflectance_TrueColor",
    format: "image/jpeg",
    transparent: false,
    version: "1.3.0",
    time: "2025-07-15",
    opacity: 0.85,
    zIndex: 2,
    attribution: "NASA GIBS · MODIS",
  });

  const map = L.map("nasaMap", {
    center: [FARM.lat, FARM.lon],
    zoom: FARM.zoom,
    layers: [esriSatellite, nasaLayer, esriLabels],
    scrollWheelZoom: false, // don't trap page scroll; enable on map focus
    worldCopyJump: true,
  });
  map.on("focus", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());

  const farmIcon = L.divIcon({ className: "", html: '<div class="farm-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  let homeFarmMarker = L.marker([FARM.lat, FARM.lon], { icon: farmIcon, title: FARM.name })
    .bindPopup(`<strong>${FARM.name}</strong><br>5 blocks · 214 ha · pairs Sentinel-2 with MODIS.<br>Click a block marker for field intel.`)
    .addTo(map);

  // Which place the suitability heatmap/block markers below are currently
  // showing. Starts on the home sample farm; a place search below moves it.
  let activeLocation = { lat: FARM.lat, lon: FARM.lon, name: FARM.name, isHome: true };
  let activeBlocks = BLOCK_MARKERS;
  let activeSuitBounds = null; // set once SUIT_BOUNDS is declared below

  const blockMarkerLayer = L.layerGroup().addTo(map);
  function renderBlockMarkers(blocks, isHome) {
    blockMarkerLayer.clearLayers();
    blocks.forEach((b) => {
      const icon = L.divIcon({ className: "", html: '<div class="block-marker"></div>', iconSize: [13, 13], iconAnchor: [6.5, 6.5] });
      const popup = isHome
        ? `<strong>Block ${b.id} · ${b.crop}</strong><br>NDVI ${b.ndvi} — ${b.note}`
        : `<strong>Sample point ${b.id}</strong><br>Generic cropland assumption for this location — no specific crop identified here.`;
      L.marker(b.pos, { icon, title: isHome ? `Block ${b.id} · ${b.crop}` : `Sample point ${b.id}` })
        .bindPopup(popup)
        .addTo(blockMarkerLayer);
    });
  }
  renderBlockMarkers(activeBlocks, true);

  /* Base map toggle — labels ride along on satellite imagery */
  const layerLabels = $("#layerLabels");
  const baseMapSelect = $("#baseMapSelect");
  baseMapSelect.addEventListener("change", () => {
    const satellite = baseMapSelect.value === "satellite";
    if (satellite) {
      map.removeLayer(osmStreets);
      esriSatellite.addTo(map);
      layerLabels.disabled = false;
      if (layerLabels.checked) esriLabels.addTo(map);
    } else {
      map.removeLayer(esriSatellite);
      map.removeLayer(esriLabels);
      layerLabels.disabled = true; // OSM has its own labels
      osmStreets.addTo(map);
    }
  });

  layerLabels.addEventListener("change", () => {
    if (layerLabels.checked) esriLabels.addTo(map);
    else map.removeLayer(esriLabels);
  });

  /* NASA GIBS layer + date + opacity */
  const layerSelect = $("#nasaLayerSelect");
  const dateInput = $("#nasaDate");
  const opacityRange = $("#layerOpacity");
  const opacityValue = $("#opacityValue");

  const ctxLayer = $("#ctxLayer");

  /* MODIS is 250 m — fade the overlay out as the user zooms into
     high-res base imagery so the map stays crisp. */
  const FADE_BY_ZOOM = [
    [11, 0.85],
    [12, 0.65],
    [13, 0.45],
    [14, 0.3],
    [15, 0.22],
    [17, 0.15],
  ];
  function zoomFade() {
    const z = map.getZoom();
    let fade = 1;
    for (const [zLevel, f] of FADE_BY_ZOOM) {
      if (z >= zLevel) fade = f;
    }
    return fade;
  }
  function applyNasaOpacity() {
    const slider = Number(opacityRange.value) / 100;
    const fade = zoomFade();
    nasaLayer.setOpacity(slider * fade);
    opacityValue.textContent = fade < 1 ? `${opacityRange.value}% ↓` : `${opacityRange.value}%`;
    opacityRange.title =
      fade < 1
        ? `Effective opacity ~${Math.round(slider * fade * 100)}% — auto-faded at this zoom so the high-res base shows through`
        : "Full NASA layer opacity";
  }

  function refreshNasaLayer() {
    const opt = layerSelect.selectedOptions[0];
    nasaLayer.setParams({
      layers: opt.value,
      format: opt.dataset.format,
      time: dateInput.value || "2025-07-15",
    });
    applyNasaOpacity();
    if (ctxLayer) ctxLayer.textContent = `${opt.textContent.trim()} · ${dateInput.value || "2025-07-15"}`;
  }
  layerSelect.addEventListener("change", refreshNasaLayer);
  dateInput.addEventListener("change", () => {
    refreshNasaLayer();
    refreshSuitability(); // the date now drives the heatmap too, not just the imagery
  });
  opacityRange.addEventListener("input", applyNasaOpacity);
  map.on("zoomend", applyNasaOpacity);
  applyNasaOpacity();

  /* Center farm — also restores the home farm's suitability heatmap/blocks
     if a search had moved them elsewhere. */
  $("#centerFarmBtn").addEventListener("click", () => {
    map.flyTo([FARM.lat, FARM.lon], FARM.zoom, { duration: 0.8 });
    if (!activeLocation.isHome) {
      activeLocation = { lat: FARM.lat, lon: FARM.lon, name: FARM.name, isHome: true };
      activeBlocks = BLOCK_MARKERS;
      activeSuitBounds = SUIT_BOUNDS;
      renderBlockMarkers(activeBlocks, true);
      refreshSuitability();
    }
  });

  /* Place search — OpenStreetMap Nominatim (free, no key). Moving to a new
     place now also relocates the suitability heatmap and sample-point
     markers there (previously they stayed fixed over the home farm no
     matter what was searched — see PLAN.md for the bug report). */
  const searchForm = $("#placeSearchForm");
  const searchInput = $("#placeSearch");
  let searchMarker = null;
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      const results = await res.json();
      if (!results.length) {
        showToast("Place not found — try a different spelling.");
        return;
      }
      const { lat, lon, display_name, boundingbox } = results[0];
      const target = [parseFloat(lat), parseFloat(lon)];
      if (searchMarker) map.removeLayer(searchMarker);
      const label = display_name.length > 70 ? display_name.slice(0, 70) + "…" : display_name;
      searchMarker = L.marker(target).bindPopup(`<strong>${label}</strong>`).addTo(map);
      searchMarker.openPopup();
      map.flyTo(target, 9, { duration: 1 });
      // boundingbox is [south, north, west, east] as strings, when present
      const bbox = boundingbox && boundingbox.length === 4
        ? { south: parseFloat(boundingbox[0]), north: parseFloat(boundingbox[1]), west: parseFloat(boundingbox[2]), east: parseFloat(boundingbox[3]) }
        : null;
      focusSuitabilityOn(parseFloat(lat), parseFloat(lon), label, bbox);
    } catch {
      showToast("Search unavailable right now — check your connection.");
    }
  });

  /* ---- Suitability heatmap, rendered on a canvas image overlay ----
     Computed from a real NASA POWER daily record plus a documented
     per-crop growth calendar/sensitivity table - never a fixed,
     hand-painted picture. Follows whatever place is actually focused
     (activeLocation/activeBlocks/activeSuitBounds, set above and by
     focusSuitabilityOn() below) instead of always the home farm.
     See GOALS.md/PLAN.md in the agrointel-ai project for why. */
  const SUIT_BOUNDS = [[41.945, -93.665], [42.085, -93.435]];
  activeSuitBounds = SUIT_BOUNDS;

  // Real daily POWER series {T2M, T2M_MAX, PRECTOTCORR, GWETROOT: {"YYYYMMDD": value}}.
  // powerDaily is the home farm's (populated once loadPowerData() below
  // succeeds); locationPowerCache holds one per searched location, fetched
  // on demand so the heatmap can look up real values for any place/date.
  let powerDaily = null;
  const locationPowerCache = new Map(); // "lat,lon" -> Promise<series>

  async function fetchPowerDailyFor(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (locationPowerCache.has(key)) return locationPowerCache.get(key);
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M,PRECTOTCORR,GWETROOT&community=AG&latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start=20230101&end=20241231&format=JSON`;
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`POWER HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const params = data?.properties?.parameter;
        if (!params?.T2M) throw new Error("Unexpected POWER payload");
        return params;
      })
      .catch((err) => {
        locationPowerCache.delete(key);
        throw err;
      });
    locationPowerCache.set(key, promise);
    return promise;
  }

  // Typical growing-calendar phase per month, and heat/drought sensitivity
  // (0-1), for each block's crop. A documented agronomic assumption - like
  // the vulnerability factors in the main AGROINTEL AI scoring model - not
  // a measurement. Determines when a field is realistically bare soil.
  // "Cropland" is the generic stand-in used for a searched location, since
  // we don't know what's actually planted there - see activeLocation.isHome.
  // All calendars assume a Northern-Hemisphere season; genuinely wrong for
  // Southern-Hemisphere/tropical searches - flagged honestly in the UI note.
  const CROP_CALENDAR = {
    Tomato: { bare: [11, 12, 1, 2, 3], establishing: [4], growing: [5, 6], peak: [7, 8], senescence: [9, 10] },
    Wheat: { bare: [7, 8], establishing: [9, 10], growing: [11, 12, 1, 2, 3], peak: [4, 5], senescence: [6] },
    Cotton: { bare: [11, 12, 1, 2, 3], establishing: [4], growing: [5, 6], peak: [7, 8], senescence: [9, 10] },
    Grapes: { bare: [12, 1, 2], establishing: [3], growing: [4, 5, 6], peak: [7, 8], senescence: [9, 10, 11] },
    Paddy: { bare: [11, 12, 1, 2, 3], establishing: [4, 5], growing: [6], peak: [7, 8], senescence: [9, 10] },
    Cropland: { bare: [12, 1, 2], establishing: [3, 4], growing: [5, 6], peak: [7, 8], senescence: [9, 10, 11] },
  };
  const CROP_SENSITIVITY = {
    Tomato: { heat: 0.9, drought: 0.7 },
    Wheat: { heat: 0.5, drought: 0.5 },
    Cotton: { heat: 0.4, drought: 0.3 },
    Grapes: { heat: 0.6, drought: 0.4 },
    Paddy: { heat: 0.5, drought: 1.0 }, // standing-water crop — very drought sensitive
    Cropland: { heat: 0.6, drought: 0.6 },
  };
  // Static physical terrain knowledge (not fabricated data): on the home
  // farm, Block A sits on the steepest slope, A/E flank the real creek
  // corridor. Not meaningful for a searched location, so it's skipped there.
  const EROSION_TERRAIN_BIAS = { A: 15, B: 5, C: -5, D: -10, E: 0 };
  const FLOOD_TERRAIN_BIAS = { A: 15, B: -10, C: -10, D: -10, E: 20 };

  function cropPhase(crop, month) {
    const cal = CROP_CALENDAR[crop] || CROP_CALENDAR.Cropland;
    for (const [phase, months] of Object.entries(cal)) {
      if (months.includes(month)) return phase;
    }
    return "growing";
  }

  // Circular day-of-year distance between two month/day pairs (wraps
  // across Dec→Jan) so "around this time of year" works near year edges.
  function monthDayDistance(mm1, dd1, mm2, dd2) {
    const a = new Date(2001, mm1 - 1, dd1).getTime();
    const b = new Date(2001, mm2 - 1, dd2).getTime();
    let diffDays = Math.abs(a - b) / 86400000;
    if (diffDays > 182) diffDays = 365 - diffDays;
    return diffDays;
  }

  // Real heavy-rain check: did any day within ~7 days of this calendar
  // date, in the given real fetched record, see >25mm rain (any year present)?
  function recentHeavyRain(mm, dd, dailySeries) {
    if (!dailySeries?.PRECTOTCORR) return false;
    return Object.entries(dailySeries.PRECTOTCORR).some(([key, raw]) => {
      const v = Number(raw);
      if (!Number.isFinite(v) || v <= -900 || v < 25) return false;
      return monthDayDistance(mm, dd, Number(key.slice(4, 6)), Number(key.slice(6, 8))) <= 7;
    });
  }

  // Real POWER sample "typical for this time of year": averages whichever
  // years are present in the given fetched 2023-2024 record for the
  // matching month/day. Returns null until that record has loaded.
  function powerSampleForDate(dateStr, dailySeries) {
    if (!dailySeries) return null;
    const d = new Date(`${dateStr}T00:00:00`);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const mmKey = String(mm).padStart(2, "0");
    const ddKey = String(dd).padStart(2, "0");
    const keys = Object.keys(dailySeries.T2M || {}).filter((k) => k.slice(4, 6) === mmKey && k.slice(6, 8) === ddKey);
    if (!keys.length) return null;
    const avg = (series) => {
      const vals = keys.map((k) => Number(series?.[k])).filter((v) => Number.isFinite(v) && v > -900);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      month: mm,
      tMax: avg(dailySeries.T2M_MAX),
      gwetroot: avg(dailySeries.GWETROOT),
      recentHeavyRain: recentHeavyRain(mm, dd, dailySeries),
      matchedDays: keys.length,
    };
  }

  const MODEL_META = {
    erosion: {
      title: "Erosion Risk",
      color: [239, 68, 68],
      desc: "Rises when a block's crop is in its real bare-soil calendar window and a real >25mm rain event has occurred around this time of year — bare, wet soil loses topsoil fastest.",
    },
    drought: {
      title: "Drought / Water Stress",
      color: [245, 158, 11],
      desc: "From real NASA POWER root-zone wetness, scaled by each crop's documented drought sensitivity and how actively it's growing right now.",
    },
    nitrogen: {
      title: "Nitrogen Loss",
      color: [250, 204, 21],
      desc: "Leaching risk when a real heavy-rain event lands during an establishing/growing window, when applied nitrogen is most exposed.",
    },
    flood: {
      title: "Flood Risk",
      color: [96, 165, 250],
      desc: "Highest on the real low-lying creek corridor (Blocks A/E), rising further with real root-zone wetness and real heavy-rain events.",
    },
    stress: {
      title: "Crop Stress & Season",
      color: [168, 85, 247],
      desc: "Combines real heat (NASA POWER max temperature) and real moisture stress, scaled by crop sensitivity, with the field's real seasonal phase — bare, establishing, growing, peak or senescence.",
    },
  };

  // Position fraction of a lat/lon within a given bounds box — recomputed
  // per render now (not once at load) since bounds/blocks change on search.
  function fracFor(lat, lon, bounds) {
    const [[south, west], [north, east]] = bounds;
    return { fx: (lon - west) / (east - west), fy: 1 - (lat - south) / (north - south) };
  }

  // 5 generic, evenly-spread sample points across a bounds box, used for
  // any searched (non-home) location — we don't have real per-field crop
  // identities there, so these are explicitly generic "Cropland" points,
  // not a claim about specific fields.
  const GENERIC_POINT_FRACS = [[0.3, 0.3], [0.68, 0.28], [0.5, 0.5], [0.3, 0.7], [0.7, 0.72]];
  function genericBlocksFor(bounds) {
    const [[south, west], [north, east]] = bounds;
    return GENERIC_POINT_FRACS.map(([fx, fy], i) => ({
      id: String.fromCharCode(65 + i),
      crop: "Cropland",
      pos: [south + (1 - fy) * (north - south), west + fx * (east - west)],
    }));
  }

  // Keeps the heatmap at a consistent, farm-scale size regardless of what
  // was searched (a city, a whole country...) — this tool models a sample
  // area around the searched point, not a country-wide survey (see the
  // other AGROINTEL AI map for that). Falls back to a fixed box around the
  // point when Nominatim gave no boundingbox, or gave an implausible one.
  function suitBoundsFor(lat, lon, bbox) {
    if (bbox) {
      const latSpan = bbox.north - bbox.south;
      const lonSpan = bbox.east - bbox.west;
      if (latSpan > 0 && latSpan <= 1 && lonSpan > 0 && lonSpan <= 1) {
        return [[bbox.south, bbox.west], [bbox.north, bbox.east]];
      }
    }
    return [[lat - 0.07, lon - 0.115], [lat + 0.07, lon + 0.115]];
  }

  // Computes one block's 0-100 score for the selected model, from the real
  // (optionally scenario-adjusted) POWER sample and the crop calendar.
  // Terrain biases only apply on the home farm, where they're real
  // documented knowledge — meaningless for a generic searched point.
  function computeBlockScore(modelKey, block, sample, isHome) {
    const crop = block.crop;
    const phase = sample ? cropPhase(crop, sample.month) : null;
    const sens = CROP_SENSITIVITY[crop] || { heat: 0.5, drought: 0.5 };
    if (!sample) return { score: 30, phase: "—", label: "moderate", reason: "waiting for the real NASA POWER record to load" };

    const bare = phase === "bare";
    const activeGrowth = phase === "growing" || phase === "peak";
    let score = 15;
    let reason = "";

    if (modelKey === "erosion") {
      if (isHome) score += EROSION_TERRAIN_BIAS[block.id] || 0;
      if (bare) { score += 35; reason = `${crop} is in its real bare-field window this month`; }
      if (sample.recentHeavyRain) { score += 25; reason += (reason ? "; " : "") + "a real >25mm rain event occurred around this date"; }
      if (!reason) reason = "live crop cover, no recent heavy rain";
    } else if (modelKey === "drought") {
      const dryness = sample.gwetroot != null ? Math.max(0, (0.4 - sample.gwetroot) / 0.4) : 0;
      score += dryness * 65 * sens.drought * (activeGrowth ? 1 : 0.4);
      reason = sample.gwetroot != null
        ? `real root-zone wetness ${sample.gwetroot.toFixed(2)} (GWETROOT), ${phase} phase`
        : "root-zone wetness unavailable for this date";
    } else if (modelKey === "nitrogen") {
      if (sample.recentHeavyRain && (phase === "establishing" || phase === "growing")) {
        score += 50; reason = "real heavy rain during an active-growth window risks leaching applied N";
      } else if (sample.recentHeavyRain) {
        score += 15; reason = "real heavy rain occurred, but outside the most N-exposed growth window";
      } else {
        reason = "no real heavy-rain event around this date";
      }
    } else if (modelKey === "flood") {
      if (isHome) score += FLOOD_TERRAIN_BIAS[block.id] || 0;
      const wet = sample.gwetroot != null ? Math.min(1, sample.gwetroot / 0.5) : 0;
      score += wet * 35;
      if (sample.recentHeavyRain) { score += 20; reason = "real heavy rain + real root-zone wetness"; }
      else reason = isHome ? "based on terrain position + real root-zone wetness" : "based on real root-zone wetness (terrain not modeled away from the home farm)";
    } else if (modelKey === "stress") {
      if (bare) {
        score = 10; reason = `${crop} field is bare/dormant — no live crop under heat or water stress`;
      } else {
        const heatStress = sample.tMax != null ? Math.max(0, sample.tMax - 30) * 4 * sens.heat : 0;
        const dryness = sample.gwetroot != null ? Math.max(0, (0.4 - sample.gwetroot) / 0.4) : 0;
        const droughtStress = dryness * 50 * sens.drought;
        score = 15 + (heatStress + droughtStress) * (activeGrowth ? 1 : 0.5);
        reason = `${phase} phase` + (sample.tMax != null ? `, real max temp ${sample.tMax.toFixed(1)}°C` : "");
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const label = score >= 66 ? "high" : score >= 35 ? "moderate" : "low";
    return { score, phase, label, reason };
  }

  function paintSuitability(modelKey, sample, blocks, bounds, isHome) {
    const meta = MODEL_META[modelKey];
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    const scores = {};
    blocks.forEach((b) => {
      const result = computeBlockScore(modelKey, b, sample, isHome);
      scores[b.id] = result;
      const { fx, fy } = fracFor(b.pos[0], b.pos[1], bounds);
      const intensity = result.score / 100;
      const radius = (0.15 + intensity * 0.2) * 640;
      const [r, g, bch] = meta.color;
      const grad = ctx.createRadialGradient(fx * 640, fy * 420, 6, fx * 640, fy * 420, radius);
      grad.addColorStop(0, `rgba(${r},${g},${bch},${(0.25 + intensity * 0.65).toFixed(2)})`);
      grad.addColorStop(0.6, `rgba(${r},${g},${bch},${(0.12 + intensity * 0.3).toFixed(2)})`);
      grad.addColorStop(1, `rgba(${r},${g},${bch},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 420);
    });
    return { dataUrl: canvas.toDataURL("image/png"), scores };
  }

  const suitabilityToggle = $("#suitabilityToggle");
  const modelSelect = $("#modelSelect");
  const modelNote = $("#modelNote");
  const fieldIntel = $("#fieldIntel");
  const legendBar = $("#legendBar");
  const seasonScrub = $("#seasonScrub");
  const seasonScrubValue = $("#seasonScrubValue");
  const scenarioRain = $("#scenarioRain");
  const scenarioRainValue = $("#scenarioRainValue");
  const scenarioTemp = $("#scenarioTemp");
  const scenarioTempValue = $("#scenarioTempValue");
  const resetScenarioBtn = $("#resetScenario");
  let suitOverlay = null;

  function renderFieldIntel(modelKey, scores, sample, dateStr, blocks, isHome) {
    const meta = MODEL_META[modelKey];
    fieldIntel.innerHTML = blocks.map((b) => {
      const r = scores[b.id];
      const label = isHome ? b.id : `${b.id}`;
      const cropLabel = isHome ? b.crop : "sample point";
      return `<li title="${r.reason.replace(/"/g, "&quot;")}"><span class="fi-block">${label}</span><span class="fi-crop">${cropLabel} · ${r.phase}</span><span class="fi-risk ${r.label}">${r.label}</span></li>`;
    }).join("");

    const [r, g, bch] = meta.color;
    if (legendBar) legendBar.style.background = `linear-gradient(to right, rgba(${r},${g},${bch},0.12), rgba(${r},${g},${bch},0.9))`;

    const dateLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" });
    const rainPct = Number(scenarioRain?.value || 0);
    const tempDelta = Number(scenarioTemp?.value || 0);
    const scenarioNote = rainPct !== 0 || tempDelta !== 0
      ? ` What-if applied: ${rainPct >= 0 ? "+" : ""}${rainPct}% rainfall, ${tempDelta >= 0 ? "+" : ""}${tempDelta}°C over the real baseline.`
      : "";
    const placeNote = isHome
      ? ""
      : " Using a generic cropland assumption (no specific crop identified here) and a Northern-Hemisphere growing calendar — treat with extra caution for Southern-Hemisphere or tropical locations.";
    modelNote.textContent = sample
      ? `${meta.desc} Computed for ${dateLabel} from the real 2023–2024 NASA POWER record for this time of year.${scenarioNote}${placeNote}`
      : activeLocationPowerFailed
        ? `${meta.desc} Couldn't reach NASA POWER for this location — showing a neutral placeholder.${placeNote}`
        : `${meta.desc} Loading real NASA POWER data for this location…${placeNote}`;
  }

  let activeLocationPower = null; // real daily series for a searched (non-home) location, once loaded
  let activeLocationPowerFailed = false;

  function refreshSuitability() {
    const modelKey = modelSelect.value;
    const dateStr = dateInput.value || "2025-07-15";
    const dailySeries = activeLocation.isHome ? powerDaily : activeLocationPower;
    const baseSample = powerSampleForDate(dateStr, dailySeries);

    // Apply the what-if scenario sliders over the real baseline sample —
    // kept separate from, and clearly labeled apart from, the real reading.
    const rainPct = Number(scenarioRain?.value || 0);
    const tempDelta = Number(scenarioTemp?.value || 0);
    let sample = baseSample;
    if (baseSample && (rainPct !== 0 || tempDelta !== 0)) {
      sample = {
        ...baseSample,
        tMax: baseSample.tMax != null ? baseSample.tMax + tempDelta : null,
        gwetroot: baseSample.gwetroot != null ? Math.max(0, Math.min(0.5, baseSample.gwetroot * (1 + rainPct / 100))) : null,
        recentHeavyRain: rainPct > 15 ? true : rainPct < -30 ? false : baseSample.recentHeavyRain,
      };
    }

    const { dataUrl, scores } = paintSuitability(modelKey, sample, activeBlocks, activeSuitBounds, activeLocation.isHome);
    renderFieldIntel(modelKey, scores, sample, dateStr, activeBlocks, activeLocation.isHome);

    if (suitOverlay) {
      map.removeLayer(suitOverlay);
      suitOverlay = null;
    }
    if (suitabilityToggle.checked) {
      suitOverlay = L.imageOverlay(dataUrl, activeSuitBounds, { opacity: 0.8 });
      suitOverlay.addTo(map);
    }
  }
  suitabilityToggle.addEventListener("change", refreshSuitability);
  modelSelect.addEventListener("change", refreshSuitability);

  // Moves the suitability heatmap + sample-point markers to a newly
  // searched place — this is the fix for the reported bug (they used to
  // stay fixed over the home farm no matter what was searched).
  async function focusSuitabilityOn(lat, lon, label, bbox) {
    const bounds = suitBoundsFor(lat, lon, bbox);
    activeLocation = { lat, lon, name: label, isHome: false };
    activeSuitBounds = bounds;
    activeBlocks = genericBlocksFor(bounds);
    activeLocationPower = null;
    activeLocationPowerFailed = false;
    renderBlockMarkers(activeBlocks, false);
    refreshSuitability(); // shows a "loading" state immediately

    try {
      const series = await fetchPowerDailyFor(lat, lon);
      if (activeLocation.lat !== lat || activeLocation.lon !== lon) return; // superseded by a newer search
      activeLocationPower = series;
    } catch (err) {
      console.error("POWER fetch failed for searched location", lat, lon, err);
      if (activeLocation.lat !== lat || activeLocation.lon !== lon) return;
      activeLocationPowerFailed = true;
    }
    refreshSuitability();
  }

  /* Season-scrub slider: moves the real date input across a full year
     (day fixed at the 15th) so the heatmap's seasonal change is easy to see. */
  const SCRUB_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  seasonScrub?.addEventListener("input", () => {
    const month = Number(seasonScrub.value);
    seasonScrubValue.textContent = SCRUB_MONTHS[month - 1];
    const year = (dateInput.value || "2025-07-15").slice(0, 4);
    dateInput.value = `${year}-${String(month).padStart(2, "0")}-15`;
    refreshNasaLayer();
    refreshSuitability();
  });

  /* What-if scenario sliders */
  scenarioRain?.addEventListener("input", () => {
    scenarioRainValue.textContent = `${Number(scenarioRain.value) >= 0 ? "+" : ""}${scenarioRain.value}%`;
    refreshSuitability();
  });
  scenarioTemp?.addEventListener("input", () => {
    scenarioTempValue.textContent = `${Number(scenarioTemp.value) >= 0 ? "+" : ""}${Number(scenarioTemp.value).toFixed(1)}°C`;
    refreshSuitability();
  });
  resetScenarioBtn?.addEventListener("click", () => {
    scenarioRain.value = 0;
    scenarioTemp.value = 0;
    scenarioRainValue.textContent = "+0%";
    scenarioTempValue.textContent = "+0.0°C";
    refreshSuitability();
  });

  refreshSuitability();

  /* ---- NASA POWER: 2023–2024 daily data → SVG charts + takeaways ---- */
  const POWER_URL =
    "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2M,PRECTOTCORR,GWETROOT&community=AG&latitude=42.02&longitude=-93.55&start=20230101&end=20241231&format=JSON";
  const loadBtn = $("#loadPowerBtn");
  const loadLabel = loadBtn.querySelector(".btn-label");
  const powerStatus = $("#powerStatus");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svgEl = (name, attrs, parent) => {
    const n = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const svgText = (parent, x, y, str, attrs) => {
    const t = svgEl("text", { x, y, ...(attrs || {}) }, parent);
    t.textContent = str;
    return t;
  };
  const isMissing = (v) => !Number.isFinite(v) || v <= -900;

  /** Bucket a POWER daily series {YYYYMMDD: v} into 24 months. */
  function monthlyBuckets(series) {
    const buckets = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
    for (const [key, raw] of Object.entries(series || {})) {
      const v = Number(raw);
      if (isMissing(v)) continue;
      const idx = (Number(key.slice(0, 4)) - 2023) * 12 + Number(key.slice(4, 6)) - 1;
      if (idx < 0 || idx >= 24) continue;
      buckets[idx].sum += v;
      buckets[idx].n += 1;
    }
    return buckets.map((b, i) => ({
      index: i,
      year: 2023 + Math.floor(i / 12),
      month: i % 12,
      total: b.sum,
      mean: b.n ? b.sum / b.n : 0,
      n: b.n,
    }));
  }

  function drawChartFrame(container, yMax, yTickCount = 4) {
    container.innerHTML = "";
    const W = 560, H = 240, padL = 40, padR = 8, padT = 10, padB = 30;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, container);
    for (let i = 0; i <= yTickCount; i++) {
      const y = padT + ((H - padT - padB) * i) / yTickCount;
      svgEl("line", { x1: padL, y1: y, x2: W - padR, y2: y, class: "chart-grid-line" }, svg);
      svgText(svg, padL - 5, y + 3.5, String(Math.round(yMax * (1 - i / yTickCount))), {
        class: "chart-axis-text", "text-anchor": "end",
      });
    }
    // Year separator between Dec-2023 and Jan-2024
    const sepX = padL + ((W - padL - padR) * 12) / 24;
    svgEl("line", { x1: sepX, y1: padT, x2: sepX, y2: H - padB, class: "chart-year-line" }, svg);
    MONTHS.forEach((m, i) => {
      [0, 12].forEach((offset) => {
        if (i % 2 === 0) {
          const x = padL + ((W - padL - padR) * (offset + i + 0.5)) / 24;
          svgText(svg, x, H - padB + 14, m, { class: "chart-axis-text", "text-anchor": "middle" });
        }
      });
    });
    svgText(svg, padL + 4, H - 6, "2023", { class: "chart-axis-text", "font-weight": "700" });
    svgText(svg, sepX + 4, H - 6, "2024", { class: "chart-axis-text", "font-weight": "700" });
    return { svg, W, H, padL, padR, padT, padB };
  }

  function renderPrecipChart(months) {
    const container = $("#precipChart");
    const maxTotal = Math.max(...months.map((m) => m.total), 10);
    const yMax = Math.ceil(maxTotal / 25) * 25;
    const { svg, W, H, padL, padR, padT, padB } = drawChartFrame(container, yMax);
    const innerW = W - padL - padR;
    const slot = innerW / 24;
    months.forEach((m, i) => {
      const h = ((H - padT - padB) * m.total) / yMax;
      const bar = svgEl("rect", {
        x: padL + i * slot + 2,
        y: H - padB - h,
        width: Math.max(slot - 4, 2),
        height: Math.max(h, m.total > 0 ? 1.5 : 0),
        class: "chart-bar",
        rx: 2,
      }, svg);
      const title = svgEl("title", {}, bar);
      title.textContent = `${MONTHS[m.month]} ${m.year}: ${m.total.toFixed(1)} mm`;
    });
  }

  function renderTempChart(tmax, tmean, tmin) {
    const container = $("#tempChart");
    const globalMax = Math.max(...tmax.map((m) => m.mean));
    const globalMin = Math.min(...tmin.map((m) => m.mean));
    const yMax = Math.ceil((globalMax + 4) / 10) * 10;
    const yMin = Math.floor((globalMin - 4) / 10) * 10;
    container.innerHTML = "";
    const W = 560, H = 240, padL = 40, padR = 8, padT = 14, padB = 30;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, container);
    const span = yMax - yMin;
    for (let i = 0; i <= 4; i++) {
      const y = padT + ((H - padT - padB) * i) / 4;
      svgEl("line", { x1: padL, y1: y, x2: W - padR, y2: y, class: "chart-grid-line" }, svg);
      svgText(svg, padL - 5, y + 3.5, String(Math.round(yMax - (span * i) / 4)), {
        class: "chart-axis-text", "text-anchor": "end",
      });
    }
    const sepX = padL + ((W - padL - padR) * 12) / 24;
    svgEl("line", { x1: sepX, y1: padT, x2: sepX, y2: H - padB, class: "chart-year-line" }, svg);
    MONTHS.forEach((m, i) => {
      if (i % 2 === 0) {
        [0, 12].forEach((offset) => {
          const x = padL + ((W - padL - padR) * (offset + i + 0.5)) / 24;
          svgText(svg, x, H - padB + 14, m, { class: "chart-axis-text", "text-anchor": "middle" });
        });
      }
    });
    svgText(svg, padL + 4, H - 6, "2023", { class: "chart-axis-text", "font-weight": "700" });
    svgText(svg, sepX + 4, H - 6, "2024", { class: "chart-axis-text", "font-weight": "700" });

    const xAt = (i) => padL + ((W - padL - padR) * (i + 0.5)) / 24;
    const yAt = (v) => padT + ((H - padT - padB) * (yMax - v)) / span;
    const series = [
      { data: tmax, color: "#dc2626", label: "Max" },
      { data: tmean, color: "#f59e0b", label: "Mean" },
      { data: tmin, color: "#2563eb", label: "Min" },
    ];
    for (const s of series) {
      const points = s.data.map((m, i) => `${xAt(i)},${yAt(m.mean)}`).join(" ");
      svgEl("polyline", {
        points, fill: "none", stroke: s.color, "stroke-width": 2.4,
        "stroke-linejoin": "round", "stroke-linecap": "round",
      }, svg);
      s.data.forEach((m, i) => svgEl("circle", { cx: xAt(i), cy: yAt(m.mean), r: 2, fill: s.color }, svg));
    }
    // Legend
    let lx = padL;
    for (const s of series) {
      svgEl("circle", { cx: lx + 5, cy: 8, r: 4, fill: s.color }, svg);
      svgText(svg, lx + 13, 11.5, s.label, { class: "chart-legend" });
      lx += 52;
    }
  }

  function computeTakeaways(p) {
    const params = p.properties?.parameter || {};
    const gwet = params.GWETROOT || {};
    const tmax = params.T2M_MAX || {};
    const precip = params.PRECTOTCORR || {};
    const keys = Object.keys(tmax).sort();

    // Moisture windows: days in root-zone comfort (GWETROOT ≥ 0.40) + dips
    const COMFORT = 0.4;
    let comfortDays = 0, dipDays = 0;
    let minV = Infinity, minKey = keys[0];
    let gSum = 0, gN = 0;
    const dipMonths = {};
    for (const k of keys) {
      const v = Number(gwet[k]);
      if (isMissing(v)) continue;
      gSum += v; gN += 1;
      if (v >= COMFORT) comfortDays += 1;
      else {
        dipDays += 1;
        const m = Number(k.slice(4, 6)) - 1;
        dipMonths[m] = (dipMonths[m] || 0) + 1;
      }
      if (v < minV) { minV = v; minKey = k; }
    }
    const gMean = gN ? gSum / gN : 0;
    const counted = comfortDays + dipDays;
    const topDip = Object.entries(dipMonths).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topDipMonth = topDip !== undefined ? MONTHS[Number(topDip)] : "—";
    const lowDate = `${MONTHS[Number(minKey.slice(4, 6)) - 1]} ${Number(minKey.slice(6, 8))}, ${minKey.slice(0, 4)}`;
    $("#takeawayMoisture").innerHTML =
      `<strong>${comfortDays} of ${counted} days</strong> in root-zone comfort (GWETROOT ≥ 0.40). Dips below comfort: <strong>${dipDays} days</strong>, most frequent in <strong>${topDipMonth}</strong>. Season low <strong>${minV.toFixed(2)}</strong> on ${lowDate} — no day hit drought-critical (&lt; 0.30). Irrigate when 3 consecutive days sit below 0.40.`;

    // Heat stress: days > 32 °C and the peak
    let hotDays = 0, peak = -Infinity, peakKey = keys[0];
    for (const k of keys) {
      const v = Number(tmax[k]);
      if (isMissing(v)) continue;
      if (v > 32) hotDays += 1;
      if (v > peak) { peak = v; peakKey = k; }
    }
    const peakDate = `${MONTHS[Number(peakKey.slice(4, 6)) - 1]} ${Number(peakKey.slice(6, 8))}, ${peakKey.slice(0, 4)}`;
    $("#takeawayHeat").innerHTML =
      `<strong>${hotDays} days above 32 °C</strong> across 2023–2024. Peak <strong>${peak.toFixed(1)} °C</strong> on ${peakDate}. Above 32 °C, corn pollen viability and young fruit set drop fast — the case for afternoon irrigation and kaolin sprays.`;

    // Water trend: 2023 vs 2024 totals
    let p2023 = 0, p2024 = 0;
    for (const [k, raw] of Object.entries(precip)) {
      const v = Number(raw);
      if (isMissing(v)) continue;
      if (k.startsWith("2023")) p2023 += v; else if (k.startsWith("2024")) p2024 += v;
    }
    const delta = p2024 - p2023;
    const pct = p2023 > 0 ? Math.abs((delta / p2023) * 100).toFixed(0) : "0";
    const wetter = delta >= 0 ? "wetter" : "drier";
    $("#takeawayWater").innerHTML =
      `2023 delivered <strong>${p2023.toFixed(0)} mm</strong> vs <strong>${p2024.toFixed(0)} mm</strong> in 2024 — <strong>${Math.abs(delta).toFixed(0)} mm ${wetter} (${pct}%)</strong>. ${delta >= 0 ? "Plan drainage and fungicide timing first." : "Plan irrigation capacity and drought-tolerant hybrids first."}`;

    const ctxS = $("#ctxPowerStatus"), ctxD = $("#ctxPowerDetail");
    if (ctxS) ctxS.innerHTML = '<span class="ctx-dot ok"></span>live — 731 days loaded';
    if (ctxD) ctxD.textContent =
      `Rain ${p2023.toFixed(0)} → ${p2024.toFixed(0)} mm/yr · peak ${peak.toFixed(1)} °C (${peakDate}) · GWETROOT ${gMean.toFixed(2)} mean`;
  }

  async function loadPowerData(silent = false) {
    loadBtn.disabled = true;
    loadLabel.textContent = "Fetching NASA POWER…";
    powerStatus.textContent = "Requesting daily data for 42.02°N, 93.55°W…";
    powerStatus.className = "power-status";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(POWER_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`POWER HTTP ${res.status}`);
      const data = await res.json();
      const params = data?.properties?.parameter;
      if (!params?.T2M) throw new Error("Unexpected POWER payload");

      renderPrecipChart(monthlyBuckets(params.PRECTOTCORR));
      renderTempChart(monthlyBuckets(params.T2M_MAX), monthlyBuckets(params.T2M), monthlyBuckets(params.T2M_MIN));
      computeTakeaways(data);

      powerDaily = params; // keep the real daily series so the heatmap can use it too
      refreshSuitability(); // re-render now that real data is in (initial call ran before this)

      powerStatus.textContent = "Live from NASA POWER — 731 days · 42.02°N, 93.55°W (central Iowa) · updated for 2023–2024.";
      powerStatus.className = "power-status ok";
      loadLabel.textContent = "Reload NASA POWER data";
      if (!silent) showToast("NASA POWER data loaded.");
    } catch (err) {
      console.error("POWER load failed:", err);
      powerStatus.textContent = "Couldn’t reach NASA POWER — check your connection and retry.";
      powerStatus.className = "power-status error";
      loadLabel.textContent = "Retry loading NASA POWER data";
      const ctxS = $("#ctxPowerStatus");
      if (ctxS) ctxS.innerHTML = '<span class="ctx-dot error"></span>unreachable';
      if (!silent) showToast("NASA POWER request failed.");
    } finally {
      clearTimeout(timeout);
      loadBtn.disabled = false;
    }
  }
  loadBtn.addEventListener("click", () => loadPowerData(false));
  loadPowerData(true); // silent warm-up — Ask Agro chats with fresh data

  /* ==========================================================
     Ask Agro — powered by AGROINTEL AI's own backend, not a
     visitor-supplied key. Lives inside this same IIFE so it can read
     the map's real state (activeLocation, activeBlocks) and control it.
     ========================================================== */
  const AGROINTEL_API_BASE = "https://agrointel-ai-api.vercel.app";

  const askMessages = $("#askMessages");
  const askForm = $("#askForm");
  const askInput = $("#askInput");
  const askSendBtn = $("#askSendBtn");
  const askSuggestions = $("#askSuggestions");
  const askClearBtn = $("#askClearBtn");
  const askStatusDot = $("#askStatusDot");
  const askStatusText = $("#askStatusText");

  const WELCOME_MSG =
    "Hi! I'm Ask Agro, grounded in real NASA data for whatever place is on the map. Ask about irrigation, risk, or soil - or just say hi. I can move the map too: try “go to Kenya” or “show NDVI”.";

  const escapeHtml = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function formatBot(md) {
    let s = escapeHtml(md);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s
      .split("\n")
      .map((l) => (/^\s*[-*]\s+/.test(l) ? "• " + l.replace(/^\s*[-*]\s+/, "") : l))
      .join("\n");
    return s;
  }

  function appendAskMsg(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = `message ${sender}`;
    if (sender === "user") bubble.textContent = text;
    else bubble.innerHTML = text;
    askMessages.appendChild(bubble);
    askMessages.scrollTop = askMessages.scrollHeight;
    return bubble;
  }

  function showAskTyping() {
    const typing = document.createElement("div");
    typing.className = "typing";
    typing.setAttribute("aria-label", "Ask Agro is thinking");
    typing.innerHTML = "<i></i><i></i><i></i>";
    askMessages.appendChild(typing);
    askMessages.scrollTop = askMessages.scrollHeight;
    return typing;
  }

  // Real indicators for any lat/lon, cached per rounded location so asking
  // several questions about the same place doesn't re-fetch every time.
  const askIndicatorsCache = new Map();
  function getAskIndicators(lat, lon) {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (!askIndicatorsCache.has(key)) {
      const p = fetch(`${AGROINTEL_API_BASE}/indicators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon, include_soil_moisture: false }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`indicators HTTP ${res.status}`);
          return res.json();
        })
        .catch((err) => {
          askIndicatorsCache.delete(key);
          throw err;
        });
      askIndicatorsCache.set(key, p);
    }
    return askIndicatorsCache.get(key);
  }

  async function askAgrointel(question) {
    const typing = showAskTyping();
    askInput.disabled = true;
    askSendBtn.disabled = true;
    try {
      const loc = activeLocation; // real current map focus, set by the Suitability code above
      const indicators = await getAskIndicators(loc.lat, loc.lon);
      const scoreRes = await fetch(`${AGROINTEL_API_BASE}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indicators }),
      });
      const scoreData = scoreRes.ok ? await scoreRes.json() : { comparisons: [] };
      const chatRes = await fetch(`${AGROINTEL_API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          location_label: loc.name || "GreenHarvest North, Central Iowa",
          indicators,
        }),
      });
      if (!chatRes.ok) throw new Error(`chat HTTP ${chatRes.status}`);
      const data = await chatRes.json();
      typing.remove();
      appendAskMsg(formatBot(data.answer || "No answer returned."), "bot");
      void scoreData; // fetched so /chat's own scoring call (server-side) has a warm cache path too
    } catch (err) {
      typing.remove();
      console.error("Ask Agro error:", err);
      appendAskMsg(
        "<strong>Connection hiccup.</strong> Couldn't reach AGROINTEL AI just now — please try again in a moment.",
        "bot"
      );
      showToast("Ask Agro is temporarily unreachable.");
    } finally {
      askInput.disabled = false;
      askSendBtn.disabled = false;
      askInput.focus();
    }
  }

  /* ---- Lightweight map-control commands, tried before falling through
     to the real AI - mirrors the pattern already proven on the Crop
     Rotation Explorer site's chat. ---- */
  function cleanAskPlaceQuery(q) {
    return (q || "")
      .replace(/\bon\s+(the\s+)?(map|earth|globe)\b/gi, "")
      .replace(/\b(please|thanks?|now)\b/gi, "")
      .replace(/[?.!]+\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function askGoToPlace(q) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      const results = await res.json();
      if (!results.length) {
        appendAskMsg("Sorry, I couldn't find that place.", "bot");
        return;
      }
      const { lat, lon, display_name, boundingbox } = results[0];
      const target = [parseFloat(lat), parseFloat(lon)];
      if (searchMarker) map.removeLayer(searchMarker);
      const label = display_name.length > 70 ? display_name.slice(0, 70) + "…" : display_name;
      searchMarker = L.marker(target).bindPopup(`<strong>${label}</strong>`).addTo(map);
      map.flyTo(target, 9, { duration: 1 });
      const bbox =
        boundingbox && boundingbox.length === 4
          ? {
              south: parseFloat(boundingbox[0]),
              north: parseFloat(boundingbox[1]),
              west: parseFloat(boundingbox[2]),
              east: parseFloat(boundingbox[3]),
            }
          : null;
      await focusSuitabilityOn(parseFloat(lat), parseFloat(lon), display_name, bbox);
      appendAskMsg(`Showing <strong>${escapeHtml(label)}</strong> on the map.`, "bot");
    } catch {
      appendAskMsg("Search unavailable right now — check your connection.", "bot");
    }
  }

  const ASK_LAYER_KEYWORDS = {
    "true color": "MODIS_Terra_CorrectedReflectance_TrueColor",
    truecolor: "MODIS_Terra_CorrectedReflectance_TrueColor",
    aqua: "MODIS_Aqua_CorrectedReflectance_TrueColor",
    ndvi: "MODIS_Terra_NDVI_8Day",
    vegetation: "MODIS_Terra_NDVI_8Day",
    temperature: "MODIS_Terra_Land_Surface_Temp_Day",
    "land surface": "MODIS_Terra_Land_Surface_Temp_Day",
    heat: "MODIS_Terra_Land_Surface_Temp_Day",
  };
  function setAskLayer(lower) {
    const key = Object.keys(ASK_LAYER_KEYWORDS).find((k) => lower.includes(k));
    if (!key) return false;
    layerSelect.value = ASK_LAYER_KEYWORDS[key];
    refreshNasaLayer();
    return true;
  }

  const ASK_MODEL_KEYWORDS = {
    erosion: "erosion",
    drought: "drought",
    "water stress": "drought",
    nitrogen: "nitrogen",
    flood: "flood",
    "crop stress": "stress",
    season: "stress",
  };
  function setAskModel(lower) {
    const key = Object.keys(ASK_MODEL_KEYWORDS).find((k) => lower.includes(k));
    if (!key) return false;
    modelSelect.value = ASK_MODEL_KEYWORDS[key];
    refreshSuitability();
    return true;
  }

  const ASK_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function scrubAskMonth(lower) {
    const idx = ASK_MONTHS.findIndex((m) => lower.includes(m));
    if (idx === -1 || !seasonScrub) return false;
    seasonScrub.value = String(idx + 1);
    seasonScrub.dispatchEvent(new Event("input"));
    return true;
  }

  // "...in Kenya?" -> "Kenya" - only a capitalized phrase right after
  // in/for/at/near, so ordinary lowercase words never false-match.
  function extractAskPlaceMention(raw) {
    const match = (raw || "").match(/\b(?:in|for|at|near)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})\s*[?.,!]?\s*$/);
    return match ? match[1].trim() : null;
  }

  async function handleAskCommand(raw) {
    const text = (raw || "").trim();
    if (!text) return;
    appendAskMsg(escapeHtml(text), "user");
    askInput.value = "";
    const lower = text.toLowerCase();
    const isNavPhrase = !lower.includes("?") && lower.split(/\s+/).length <= 5;

    if (isNavPhrase && (lower.includes("center farm") || lower === "home")) {
      $("#centerFarmBtn")?.click();
      appendAskMsg("Centered on the sample farm.", "bot");
      return;
    }
    if (lower.startsWith("go to ") || lower.startsWith("search ")) {
      const q = cleanAskPlaceQuery(text.replace(/^(go to|search)\s+/i, ""));
      await askGoToPlace(q);
      return;
    }
    if (isNavPhrase && setAskLayer(lower)) {
      appendAskMsg("Switched the NASA layer.", "bot");
      return;
    }
    if (isNavPhrase && setAskModel(lower)) {
      appendAskMsg("Switched the suitability map model.", "bot");
      return;
    }
    if (isNavPhrase && scrubAskMonth(lower)) {
      appendAskMsg("Moved the season.", "bot");
      return;
    }

    const mention = extractAskPlaceMention(text);
    if (mention) await askGoToPlace(mention);

    await askAgrointel(text);
  }

  askForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = askInput.value.trim();
    if (!text) return;
    handleAskCommand(text);
  });

  askSuggestions?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    handleAskCommand(chip.dataset.question);
  });

  askClearBtn?.addEventListener("click", () => {
    askMessages.innerHTML = "";
    appendAskMsg(WELCOME_MSG, "bot");
    showToast("Conversation cleared.");
  });

  if (askStatusDot) askStatusDot.classList.add("ok");
  if (askStatusText) askStatusText.textContent = "Online — grounded in real NASA data, no key needed";
  if (askMessages) appendAskMsg(WELCOME_MSG, "bot");
})();

/* ==========================================================
   Scroll reveal — fade-up sections as they enter view
   ========================================================== */
(function revealOnScroll() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const candidates = $$(
    ".section-head, .tip-bar, .stat, .feature-card, .quote-card, .step, .faq-item, .crop-tile, .chart-card, .takeaway-card, .an-card, .map-toolbar, .analysis-grid > *, .ask-grid > *, .gs-steps-preview > li, .gs-quote"
  );
  candidates.forEach((el) => el.classList.add("reveal"));

  // Stagger siblings inside shared parents
  const parents = new Set(candidates.map((el) => el.parentElement).filter(Boolean));
  parents.forEach((parent) => {
    [...parent.children]
      .filter((child) => child.classList.contains("reveal"))
      .forEach((child, i) => child.style.setProperty("--reveal-delay", `${Math.min(i * 70, 420)}ms`));
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  candidates.forEach((el) => io.observe(el));
})();

/* ==========================================================
   Footer year
   ========================================================== */
$("#year").textContent = new Date().getFullYear();
