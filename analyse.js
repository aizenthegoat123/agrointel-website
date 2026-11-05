/* ==========================================================
   Crop Analyse — block report logic
   Charts hand-rolled in SVG; NASA POWER fetched live (with
   offline fallback so the page works from a file:// URL).
   ========================================================== */

"use strict";

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

/* ==========================================================
   Sample-farm dataset — five blocks
   ========================================================== */
const CROPS = {
  tomato: {
    id: "A", crop: "Tomato", variety: "Arka Rakshak", area: "38.1 ha",
    stage: "Flowering", ndvi: 0.62, severity: "High stress", sevClass: "bad",
    delta: "▼ 0.16 vs 4 passes ago", deltaUp: false,
    note: "Canopy density is falling — blight lesion load confirmed on lower leaves; NDVI has dropped three passes in a row.",
    verdict: "FieldVision™: early blight (Alternaria solani) — 94% confidence · severity high · flowering · 38.1 ha",
    rec: "Chlorothalonil 2.0 L/ha this Thursday 6–9 AM · strip and destroy infected lower leaves · switch to drip irrigation · re-check NDVI in 18 days.",
    ndviSeries: [0.78, 0.75, 0.73, 0.70, 0.68, 0.66, 0.64, 0.62],
    planting: [
      { name: "Raised beds + drip (90 × 60 cm)", fit: 93, best: true,
        specs: [["Bed width", "1.0 m"], ["Spacing", "90 × 60 cm"], ["Irrigation", "Drip, 2×/day"]],
        note: "Keeps roots aerated and foliage dry — the single biggest fix for early blight pressure." },
      { name: "Staking + straw mulch", fit: 78,
        specs: [["Stakes", "1.8 m, bamboo"], ["Mulch", "5–7 cm paddy straw"], ["Spacing", "75 × 60 cm"]],
        note: "Dries leaf surface after rain; labour-heavy but cheap inputs." },
      { name: "Direct seeding (broadcast)", fit: 55,
        specs: [["Seed rate", "450 g/ha"], ["Depth", "0.5–1 cm"], ["Window", "Jun–Jul"]],
        note: "Skips nursery cost but germination is patchy in hot beds — expect gappy stands." },
    ],
    actions: [
      "Spray chlorothalonil 2.0 L/ha Thursday 6–9 AM (wind < 8 km/h)",
      "Strip and destroy infected lower leaves — never compost",
      "Switch to drip irrigation; keep foliage dry at dusk",
      "Log NDVI again after 18 days — target ≥ 0.70",
    ],
  },
  wheat: {
    id: "B", crop: "Wheat", variety: "Lok-1", area: "42.6 ha",
    stage: "Tillering", ndvi: 0.78, severity: "Healthy", sevClass: "ok",
    delta: "▲ 0.04 vs 4 passes ago", deltaUp: true,
    note: "Uniform canopy, even vigour across the block; lodging risk low at this density.",
    verdict: "FieldVision™: healthy canopy — NDVI 0.78, tillering, on track for 8.9 t/ha · 42.6 ha",
    rec: "No spray needed. Side-dress urea at CRI (21 days) · keep an eye on aphids on the flag leaf · NDVI re-check Nov 30.",
    ndviSeries: [0.66, 0.68, 0.70, 0.72, 0.74, 0.75, 0.77, 0.78],
    planting: [
      { name: "Drill sowing (20 cm rows)", fit: 92, best: true,
        specs: [["Rows", "20 cm"], ["Seed rate", "100 kg/ha"], ["Depth", "5 cm"]],
        note: "Even stand, best germination — needs timely moisture at sowing; ideal for irrigated wheat." },
      { name: "Zero-till into paddy stubble", fit: 84,
        specs: [["Tillage", "None"], ["Seed rate", "110 kg/ha"], ["Window", "Nov 10–25"]],
        note: "Saves ~₹3,200/ha and 10 days; needs clean residue and a calibrated zero-till drill." },
      { name: "Broadcast + rotavator", fit: 61,
        specs: [["Seed rate", "120 kg/ha"], ["Cover", "Light harrow"], ["Best for", "Small plots"]],
        note: "Fastest to sow but uneven stands and weaker tillering — bump seed rate to compensate." },
    ],
    actions: [
      "Side-dress urea 25 kg N/ha at CRI (21 days after sowing)",
      "Scout flag leaf weekly for aphid colonies",
      "Irrigate 20 mm if GWETROOT dips below 0.40",
    ],
  },
  cotton: {
    id: "C", crop: "Cotton", variety: "RCH-773 (Bt)", area: "61.4 ha",
    stage: "Boll formation", ndvi: 0.66, severity: "Watch", sevClass: "watch",
    delta: "▲ 0.06 vs 4 passes ago", deltaUp: true,
    note: "Growth steady but aphid pressure building on the undersides of young leaves in rows 4–9.",
    verdict: "FieldVision™: healthy-but-watch — NDVI 0.66, boll formation, aphid risk moderate · 61.4 ha",
    rec: "Scout rows 4–9 this week · neem oil 5 ml/L if >20 aphids/leaf · release ladybirds · re-check bolls in 10 days.",
    ndviSeries: [0.60, 0.62, 0.63, 0.65, 0.66, 0.67, 0.66, 0.66],
    planting: [
      { name: "Ridge sowing on 90 cm ridges", fit: 88, best: true,
        specs: [["Ridges", "90 cm apart"], ["Seed rate", "2.5 kg/ha"], ["Depth", "4–5 cm"]],
        note: "Root aeration + fast drainage — the safest bet on black cotton soil in a wet year." },
      { name: "Dibbled 60 × 30 cm, 2 seeds/hill", fit: 74,
        specs: [["Spacing", "60 × 30 cm"], ["Plants/ha", "~55,000"], ["Labour", "High"]],
        note: "Precise population and easy scouting; costs more in labour at sowing and thinning." },
      { name: "Skip-row (2 : 1)", fit: 66,
        specs: [["Pattern", "2 rows : 1 skip"], ["Rows", "90 cm"], ["Benefit", "Microclimate"]],
        note: "Open canopy cuts bollworm pressure; fewer plants but larger bolls." },
    ],
    actions: [
      "Scout rows 4–9 — neem oil 5 ml/L if counts exceed 20/leaf",
      "Release ladybird beetles (2,000/ha) as biocontrol",
      "Re-check boll retention in 10 days; mark 50 plants",
    ],
  },
  grapes: {
    id: "D", crop: "Grapes", variety: "Thompson Seedless", area: "29.8 ha",
    stage: "Veraison", ndvi: 0.83, severity: "Excellent", sevClass: "ok",
    delta: "▲ 0.02 vs 4 passes ago", deltaUp: true,
    note: "Canopy dense and uniform; berries entering colour-break; sugar accumulation on track.",
    verdict: "FieldVision™: veraison — NDVI 0.83, excellent vigour; watch water before harvest · 29.8 ha",
    rec: "Irrigate 18 mm this morning, then hold steady · check drip emitters · Brix check twice weekly · bird netting from colour-break.",
    ndviSeries: [0.72, 0.74, 0.77, 0.79, 0.81, 0.82, 0.83, 0.83],
    planting: [
      { name: "VSP cordon, 3 × 1.5 m", fit: 90, best: true,
        specs: [["System", "Vertical shoot positioning"], ["Spacing", "3.0 × 1.5 m"], ["Cordon", "1.1 m"]],
        note: "Uniform light and spray penetration — best colour and airflow, the export-grade standard." },
      { name: "Geneva Double Curtain", fit: 82,
        specs: [["System", "GDC, 4 wires"], ["Spacing", "3.0 × 1.8 m"], ["Trellis", "Heavy-duty"]],
        note: "Highest yields per hectare; needs strong end-posts and steady cane tying." },
      { name: "Pergola (sloped)", fit: 70,
        specs: [["System", "Overhead pergola"], ["Spacing", "4.0 × 4.0 m"], ["Shading", "High"]],
        note: "Cooler canopy and less sunburn — but lower Brix; avoid on small plots." },
    ],
    actions: [
      "Irrigate 18 mm this morning; verify drip emitters in Block D",
      "Hold nitrogen — push Brix, not canopy",
      "Bird netting from colour-break; Brix check twice weekly",
    ],
  },
  paddy: {
    id: "E", crop: "Paddy", variety: "Pusa Basmati 1847", area: "42.1 ha",
    stage: "Panicle initiation", ndvi: 0.81, severity: "Healthy", sevClass: "ok",
    delta: "▲ 0.05 vs 4 passes ago", deltaUp: true,
    note: "Even stand; standing water 4 cm — panicle initiation on schedule.",
    verdict: "FieldVision™: panicle initiation — NDVI 0.81, healthy; maintain water till flowering · 42.1 ha",
    rec: "Keep 4 cm water till panicle emergence · scout for brown planthopper at the waterline · drain 15 days pre-harvest.",
    ndviSeries: [0.58, 0.62, 0.67, 0.71, 0.75, 0.78, 0.80, 0.81],
    planting: [
      { name: "Transplanted (puddled)", fit: 91, best: true,
        specs: [["Seedlings", "25-day-old"], ["Spacing", "20 × 15 cm"], ["Water", "2–4 cm"]],
        note: "Lowest weed pressure and safest for late sowing; needs a dependable water source." },
      { name: "Direct-seeded (DSR)", fit: 77,
        specs: [["Method", "Dry / wet DSR"], ["Seed rate", "25–30 kg/ha"], ["Saving", "25% water + labour"]],
        note: "Big input savings; demands vigilant early weed control and level fields." },
      { name: "SRI — single seedlings", fit: 69,
        specs: [["Spacing", "25 × 25 cm"], ["Seed rate", "6–8 kg/ha"], ["Skill", "High"]],
        note: "High yield potential; skill- and attention-intensive — best on small, well-managed plots." },
    ],
    actions: [
      "Maintain 4 cm standing water until panicle emergence",
      "Scout waterline weekly for brown planthopper",
      "Drain 15 days before harvest; confirm harvest window",
    ],
  },
};

const BLOCK_ORDER = ["tomato", "wheat", "cotton", "grapes", "paddy"];
const PASS_DATES = [...Array(8)].map((_, i) => {
  const d = new Date(2026, 9, 28); // 28 Oct 2026, last pass
  d.setDate(d.getDate() - 7 * (7 - i));
  return d;
});
const fmtDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isMissing = (v) => !Number.isFinite(v) || v <= -900;

/* ==========================================================
   SVG chart helpers
   ========================================================== */
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
const clear = (el) => { el.innerHTML = ""; };

function drawNdviChart(container, series, labels) {
  clear(container);
  const W = 560, H = 180, padL = 34, padR = 10, padT = 14, padB = 26;
  const min = Math.max(0.4, Math.floor((Math.min(...series) - 0.03) * 20) / 20);
  const max = Math.min(0.99, Math.ceil((Math.max(...series) + 0.03) * 20) / 20);
  const span = max - min;
  const xAt = (i) => padL + ((W - padL - padR) * (i + 0.5)) / series.length;
  const yAt = (v) => padT + ((H - padT - padB) * (max - v)) / span;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, container);
  [0.6, 0.7, 0.8].filter((t) => t > min && t < max).forEach((t) => {
    svgEl("line", { x1: padL, y1: yAt(t), x2: W - padR, y2: yAt(t), class: "chart-grid-line" }, svg);
    svgText(svg, padL - 4, yAt(t) + 3.5, t.toFixed(1), { class: "chart-axis-text", "text-anchor": "end" });
  });
  // Area fill
  const points = series.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  svgEl("polygon", {
    points: `${xAt(0)},${H - padB} ${points} ${xAt(series.length - 1)},${H - padB}`,
    fill: "#17854f", "fill-opacity": "0.12",
  }, svg);
  svgEl("polyline", {
    points, fill: "none", stroke: "#17854f", "stroke-width": 2.6,
    "stroke-linejoin": "round", "stroke-linecap": "round",
  }, svg);
  series.forEach((v, i) => {
    svgEl("circle", { cx: xAt(i), cy: yAt(v), r: i === series.length - 1 ? 4.5 : 2.5, fill: i === series.length - 1 ? "#14532d" : "#17854f" }, svg);
  });
  labels.forEach((lab, i) => {
    if (i % 2 === 0 || i === labels.length - 1) {
      svgText(svg, xAt(i), H - padB + 13, lab, { class: "chart-axis-text", "text-anchor": "middle" });
    }
  });
  svgText(svg, W - padR, padT + 2, `last ${series[series.length - 1].toFixed(2)}`, {
    class: "chart-axis-text", "text-anchor": "end", "font-weight": "700", fill: "#14532d",
  });
}

function drawGwetChart(container, daily) {
  clear(container);
  const W = 640, H = 180, padL = 34, padR = 10, padT = 12, padB = 24;
  const values = daily.map((d) => d.value);
  const min = Math.max(0.25, Math.floor((Math.min(...values) - 0.02) * 20) / 20);
  const max = Math.min(0.65, Math.ceil((Math.max(...values) + 0.02) * 20) / 20);
  const span = Math.max(max - min, 0.05);
  const xAt = (i) => padL + ((W - padL - padR) * i) / Math.max(daily.length - 1, 1);
  const yAt = (v) => padT + ((H - padT - padB) * (max - v)) / span;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, container);
  [0.35, 0.4, 0.45, 0.5].filter((t) => t > min && t < max).forEach((t) => {
    svgEl("line", { x1: padL, y1: yAt(t), x2: W - padR, y2: yAt(t), class: "chart-grid-line" }, svg);
    svgText(svg, padL - 4, yAt(t) + 3.5, t.toFixed(2), { class: "chart-axis-text", "text-anchor": "end" });
  });
  // Comfort threshold
  if (0.4 > min && 0.4 < max) {
    svgEl("line", { x1: padL, y1: yAt(0.4), x2: W - padR, y2: yAt(0.4), stroke: "#b45309", "stroke-width": 1.4, "stroke-dasharray": "5 4" }, svg);
    svgText(svg, W - padR, yAt(0.4) - 4, "comfort 0.40", { class: "chart-axis-text", "text-anchor": "end", fill: "#b45309", "font-weight": "700" });
  }
  const line = daily.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(" ");
  svgEl("polygon", {
    points: `${xAt(0)},${H - padB} ${line} ${xAt(daily.length - 1)},${H - padB}`,
    fill: "#0369a1", "fill-opacity": "0.14",
  }, svg);
  svgEl("polyline", {
    points: line, fill: "none", stroke: "#0369a1", "stroke-width": 2,
    "stroke-linejoin": "round", "stroke-linecap": "round",
  }, svg);
  // End label
  svgText(svg, W - padR, yAt(daily[daily.length - 1].value) - 6, daily[daily.length - 1].value.toFixed(2), {
    class: "chart-axis-text", "text-anchor": "end", "font-weight": "700", fill: "#0369a1",
  });
  // X labels: first, middle, last
  [0, Math.floor(daily.length / 2), daily.length - 1].forEach((i) => {
    svgText(svg, xAt(i), H - padB + 14, daily[i].label, { class: "chart-axis-text", "text-anchor": "middle" });
  });
}

function drawRainChart(container, months) {
  clear(container);
  const W = 560, H = 180, padL = 34, padR = 8, padT = 12, padB = 26;
  const yMax = Math.ceil(Math.max(...months.map((m) => m.total), 10) / 25) * 25;
  const slot = (W - padL - padR) / months.length;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" }, container);
  for (let i = 0; i <= 3; i++) {
    const y = padT + ((H - padT - padB) * i) / 3;
    svgEl("line", { x1: padL, y1: y, x2: W - padR, y2: y, class: "chart-grid-line" }, svg);
    svgText(svg, padL - 4, y + 3.5, String(Math.round(yMax * (1 - i / 3))), { class: "chart-axis-text", "text-anchor": "end" });
  }
  months.forEach((m, i) => {
    const h = ((H - padT - padB) * m.total) / yMax;
    const bar = svgEl("rect", {
      x: padL + i * slot + 1.5, y: H - padB - h, width: Math.max(slot - 3, 2),
      height: Math.max(h, m.total > 0 ? 1.5 : 0), class: "chart-bar", rx: 2,
    }, svg);
    const title = svgEl("title", {}, bar);
    title.textContent = `${monthShort[m.month]} ${m.year}: ${m.total.toFixed(0)} mm`;
    if (i % 6 === 0) svgText(svg, padL + (i + 0.5) * slot, H - padB + 14, `${monthShort[m.month]} ’${String(m.year).slice(2)}`, { class: "chart-axis-text", "text-anchor": "middle" });
  });
}

/* Bucket a POWER daily series into monthly totals/means */
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
  }));
}

/* Last 90 days as [{label, value}] */
function last90(series) {
  const rows = Object.entries(series || {})
    .map(([key, raw]) => ({ key, value: Number(raw) }))
    .filter((r) => !isMissing(r.value))
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-90);
  return rows.map((r) => ({
    label: `${r.key.slice(6, 8)} ${monthShort[Number(r.key.slice(4, 6)) - 1]}`,
    value: r.value,
    date: r.key,
  }));
}

/* ==========================================================
   Block rendering
   ========================================================== */
const GAUGE_C = 2 * Math.PI * 46;
const cropSwitch = $("#cropSwitch");
const plantList = $("#plantList");
const actionList = $("#actionList");
let currentKey = "tomato";

function actionKey(key) { return `agro_actions_${CROPS[key].id}`; }
function loadActions(key) {
  try {
    return JSON.parse(localStorage.getItem(actionKey(key)) || "[]");
  } catch {
    return [];
  }
}
function saveActions(key, flags) {
  try { localStorage.setItem(actionKey(key), JSON.stringify(flags)); } catch { /* private mode */ }
}

function renderPlanting(crop) {
  plantList.innerHTML = crop.planting
    .map((p, i) => `
      <div class="plant-card${p.best ? " best" : ""}">
        <span class="plant-rank">${i + 1}</span>
        <div class="plant-main">
          <div class="plant-name">${p.name}${p.best ? '<span class="best-pill">Best fit</span>' : ""}</div>
          <div class="plant-specs">${p.specs.map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join("")}</div>
          <p class="plant-note">${p.note}</p>
        </div>
        <div class="fit-col" aria-label="Field fit ${p.fit} out of 100">
          <span class="fit-num">${p.fit}</span>
          <div class="fit-track"><div class="fit-fill" style="width:${p.fit}%"></div></div>
          <span class="fit-label">Fit</span>
        </div>
      </div>`)
    .join("");
}

function renderActions(crop, key) {
  const flags = loadActions(key);
  actionList.innerHTML = crop.actions
    .map((a, i) => {
      const done = flags[i] === true;
      return `
      <li class="action-item${done ? " done" : ""}">
        <label for="act-${i}">
          <input type="checkbox" id="act-${i}" data-idx="${i}" ${done ? "checked" : ""} />
          <span>${a}</span>
        </label>
      </li>`;
    })
    .join("");
}

function renderBlock(key) {
  currentKey = key;
  const c = CROPS[key];

  $("#reportBlock").textContent = c.id;
  $("#reportCrop").textContent = c.crop;
  $("#reportVerdict").textContent = c.verdict;
  $("#gaugeValue").textContent = c.ndvi.toFixed(2);
  const gauge = $("#gaugeFill");
  gauge.style.strokeDashoffset = String(GAUGE_C * (1 - Math.min(c.ndvi, 1)));
  gauge.style.stroke = c.sevClass === "ok" ? "#15803d" : c.sevClass === "watch" ? "#d97706" : "#dc2626";

  const sev = $("#severityBadge");
  sev.textContent = c.severity;
  sev.className = `severity-badge${c.sevClass === "ok" ? " ok" : c.sevClass === "watch" ? " watch" : ""}`;
  $("#gaugeDelta").textContent = c.delta;
  $("#gaugeDelta").classList.toggle("up", c.deltaUp);
  $("#gaugeNote").textContent = c.note;
  $("#anRec").innerHTML = `
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
    <div><strong>FieldVision prescription</strong><br />${c.rec}</div>`;

  renderPlanting(c);
  renderActions(c, key);
  drawNdviChart($("#ndviChart"), c.ndviSeries, PASS_DATES.map(fmtDate));

  // Switcher active state
  $$(".crop-tab", cropSwitch).forEach((tab) => {
    const active = tab.dataset.crop === key;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

/* Build switcher */
BLOCK_ORDER.forEach((key) => {
  const c = CROPS[key];
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "crop-tab";
  btn.dataset.crop = key;
  btn.setAttribute("role", "tab");
  const cls = c.sevClass === "ok" ? "tab-ok" : c.sevClass === "watch" ? "tab-warn" : "tab-bad";
  btn.innerHTML = `
    <span class="crop-tab-id">${c.id}</span>
    <span class="crop-tab-meta"><b>${c.crop}</b><small>NDVI ${c.ndvi.toFixed(2)} · <span class="${cls}">${c.severity}</span></small><span class="ndvi-bar"><span style="width:${Math.round(c.ndvi * 100)}%"></span></span></span>`;
  btn.addEventListener("click", () => renderBlock(key));
  cropSwitch.appendChild(btn);
});

actionList.addEventListener("change", (e) => {
  const input = e.target.closest('input[type="checkbox"]');
  if (!input) return;
  const flags = loadActions(currentKey);
  flags[Number(input.dataset.idx)] = input.checked;
  saveActions(currentKey, flags);
  input.closest(".action-item").classList.toggle("done", input.checked);
});

/* ==========================================================
   NASA POWER — live load for GWETROOT + rainfall
   ========================================================== */
const POWER_URL =
  "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,GWETROOT&community=AG&latitude=42.02&longitude=-93.55&start=20230101&end=20241231&format=JSON";
const gwetStatus = $("#gwetStatus");
const reloadBtn = $("#reloadPowerBtn");

/* Offline fallback snapshot (labelled as such) */
const FALLBACK_GWET_90D = [
  0.46,0.45,0.44,0.43,0.44,0.42,0.41,0.40,0.42,0.43,0.44,0.45,0.46,0.44,0.43,0.41,0.40,0.38,0.37,0.38,0.40,0.42,0.44,0.45,0.46,0.47,0.46,0.45,0.44,0.43,0.45,0.46,0.47,0.48,0.47,0.46,0.45,0.44,0.43,0.42,0.41,0.42,0.44,0.45,0.46,0.44,0.43,0.42,0.41,0.40,0.39,0.40,0.42,0.43,0.45,0.46,0.47,0.48,0.47,0.46,0.45,0.44,0.43,0.44,0.45,0.46,0.47,0.46,0.45,0.44,0.43,0.42,0.41,0.42,0.43,0.44,0.45,0.46,0.47,0.45,0.44,0.43,0.42,0.41,0.40,0.41,0.42,0.43,0.44,0.45,0.46,0.47,0.46,0.45,0.44,0.45,
].map((v, i) => ({ label: `D-${90 - i}`, value: v }));
const FALLBACK_RAIN = [
  { month: 0, year: 2023, total: 12 }, { month: 1, year: 2023, total: 18 }, { month: 2, year: 2023, total: 35 },
  { month: 3, year: 2023, total: 88 }, { month: 4, year: 2023, total: 112 }, { month: 5, year: 2023, total: 95 },
  { month: 6, year: 2023, total: 78 }, { month: 7, year: 2023, total: 64 }, { month: 8, year: 2023, total: 42 },
  { month: 9, year: 2023, total: 52 }, { month: 10, year: 2023, total: 28 }, { month: 11, year: 2023, total: 9 },
  { month: 0, year: 2024, total: 15 }, { month: 1, year: 2024, total: 31 }, { month: 2, year: 2024, total: 74 },
  { month: 3, year: 2024, total: 120 }, { month: 4, year: 2024, total: 148 }, { month: 5, year: 2024, total: 132 },
  { month: 6, year: 2024, total: 96 }, { month: 7, year: 2024, total: 88 }, { month: 8, year: 2024, total: 61 },
  { month: 9, year: 2024, total: 57 }, { month: 10, year: 2024, total: 33 }, { month: 11, year: 2024, total: 14 },
];

function applyPowerData(data) {
  const params = data?.properties?.parameter || {};
  const daily = last90(params.GWETROOT);
  if (daily.length) {
    drawGwetChart($("#gwetChart"), daily);
    const mean = daily.reduce((s, d) => s + d.value, 0) / daily.length;
    $("#gwetrootNow").textContent = mean.toFixed(2);
    gwetStatus.textContent = `Live from NASA POWER — ${daily.length} days · 42.02°N, 93.55°W. Comfort threshold 0.40 GWETROOT.`;
    gwetStatus.className = "chart-status ok";
  } else {
    throw new Error("No GWETROOT rows");
  }
  const rain = monthlyBuckets(params.PRECTOTCORR);
  drawRainChart($("#rainChart"), rain);
}

function applyFallback() {
  const daily = FALLBACK_GWET_90D;
  drawGwetChart($("#gwetChart"), daily);
  $("#gwetrootNow").textContent = "0.44";
  gwetStatus.textContent = "Offline snapshot — reconnect to refresh live NASA POWER.";
  gwetStatus.className = "chart-status error";
  drawRainChart($("#rainChart"), FALLBACK_RAIN);
}

async function loadPower() {
  gwetStatus.textContent = "Fetching NASA POWER…";
  gwetStatus.className = "chart-status";
  reloadBtn.disabled = true;
  reloadBtn.querySelector(".btn-label").textContent = "Fetching…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(POWER_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applyPowerData(await res.json());
  } catch (err) {
    console.warn("NASA POWER unavailable, using offline snapshot:", err);
    applyFallback();
  } finally {
    clearTimeout(timeout);
    reloadBtn.disabled = false;
    reloadBtn.querySelector(".btn-label").textContent = "Reload NASA POWER";
  }
}

reloadBtn.addEventListener("click", loadPower);

/* Print report */
$("#printReportBtn").addEventListener("click", () => window.print());

/* Boot */
renderBlock("tomato");
loadPower();
