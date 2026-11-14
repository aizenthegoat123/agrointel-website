/* ==========================================================
   AgroIntel — crop suitability search + rotation planner
   Reads the place, date and NASA POWER record from window.AgroState
   (set up in script.js) so everything follows the map.
   ========================================================== */
(function initPlanner() {
  const state = window.AgroState;
  if (!state) return; // map failed to load (offline) — nothing to follow

  const qs = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortPlace = (name) => (name || "this place").split(",").slice(0, 2).join(",").trim();

  /* ---- Crop reference ranges -------------------------------------------
     General agronomic reference values (FAO-style crop requirement ranges),
     NOT local trial data: opt = comfortable mean temperature over the
     season (°C), hot = monthly average daily maximum above which heat
     damage is likely, frost = tender | semi | hardy, days = typical season
     length, water = seasonal water need (mm). */
  const C = (name, cat, opt, hot, frost, days, water, role, extra) => ({ name, cat, opt, hot, frost, days, water, role, ...(extra || {}) });
  const CROPS = [
    C("Wheat", "cereal", [10, 24], 32, "hardy", 130, 450, "Fibrous roots hold soil; follows legumes well.", { note: "Assumes a spring-sown type; autumn-sown winter wheat overwinters on a different calendar." }),
    C("Rice", "cereal", [20, 32], 38, "tender", 130, 1100, "Flooded paddies suppress many weeds but use a lot of water.", { aliases: ["paddy"], wet: true }),
    C("Maize", "cereal", [18, 30], 36, "tender", 120, 550, "Heavy nitrogen user — best after a legume.", { aliases: ["corn"] }),
    C("Barley", "cereal", [8, 22], 30, "hardy", 100, 400, "Short season; tolerates poorer, saltier soils."),
    C("Sorghum", "cereal", [21, 33], 40, "tender", 115, 450, "Drought-tolerant and deep-rooting."),
    C("Millet", "cereal", [22, 34], 42, "tender", 90, 350, "Very drought-tolerant; quick cover in hot, dry seasons.", { aliases: ["pearl millet", "bajra"] }),
    C("Oats", "cereal", [8, 22], 30, "hardy", 100, 450, "Good cool-season cover and forage crop."),
    C("Rye", "cereal", [5, 20], 28, "hardy", 110, 400, "Classic winter cover crop; scavenges leftover nitrogen."),
    C("Quinoa", "cereal", [10, 22], 30, "semi", 120, 350, "Tolerates poor soils and some salinity."),
    C("Tomato", "vegetable", [18, 28], 34, "tender", 110, 500, "Nightshade family — rotate away from potato, chilli and eggplant."),
    C("Potato", "vegetable", [12, 22], 29, "semi", 110, 500, "Nightshade family; leave 3+ years between potato crops."),
    C("Onion", "vegetable", [12, 25], 32, "semi", 130, 450, "Shallow roots; breaks cycles of most vegetable pests."),
    C("Cabbage", "vegetable", [10, 22], 28, "hardy", 90, 400, "Brassica — rotate away from canola, mustard and cauliflower.", { aliases: ["cauliflower", "broccoli", "kale"] }),
    C("Lettuce", "vegetable", [8, 20], 26, "semi", 60, 250, "Quick crop that fits short gaps between main crops."),
    C("Carrot", "vegetable", [10, 22], 28, "semi", 90, 400, "Taproot loosens the topsoil."),
    C("Chilli", "vegetable", [20, 30], 35, "tender", 120, 550, "Nightshade family — rotate away from tomato and potato.", { aliases: ["pepper", "capsicum", "chili"] }),
    C("Okra", "vegetable", [22, 34], 40, "tender", 80, 400, "Heat-loving; deep taproot."),
    C("Eggplant", "vegetable", [21, 30], 36, "tender", 120, 550, "Nightshade family.", { aliases: ["brinjal", "aubergine"] }),
    C("Cucumber", "vegetable", [18, 30], 35, "tender", 65, 350, "Cucurbit — rotate away from pumpkin and melon."),
    C("Pumpkin", "vegetable", [18, 30], 35, "tender", 100, 450, "Broad leaves shade out weeds.", { aliases: ["squash"] }),
    C("Spinach", "vegetable", [7, 20], 25, "hardy", 50, 200, "Fast cool-season crop."),
    C("Garlic", "vegetable", [8, 22], 30, "hardy", 150, 400, "Often autumn-planted; few shared pests with other crops."),
    C("Soybean", "legume", [20, 30], 36, "tender", 110, 500, "Fixes nitrogen for the next crop."),
    C("Beans", "legume", [16, 27], 32, "tender", 85, 350, "Fixes nitrogen; short season.", { aliases: ["bean", "common bean", "french bean"] }),
    C("Chickpea", "legume", [15, 27], 33, "semi", 100, 300, "Fixes nitrogen and needs little water.", { aliases: ["gram", "chana"] }),
    C("Lentil", "legume", [10, 24], 30, "semi", 100, 300, "Fixes nitrogen; cool-season, low water need."),
    C("Peas", "legume", [8, 20], 27, "semi", 80, 350, "Fixes nitrogen; cool-season.", { aliases: ["pea"] }),
    C("Groundnut", "legume", [22, 32], 38, "tender", 120, 500, "Fixes nitrogen; prefers light soils.", { aliases: ["peanut"] }),
    C("Cowpea", "legume", [22, 34], 40, "tender", 80, 300, "Fixes nitrogen; very drought-tolerant; good forage."),
    C("Alfalfa", "legume", [10, 28], 36, "hardy", 365, 900, "Deep-rooting perennial legume; builds soil over years.", { aliases: ["lucerne"], perennial: true }),
    C("Clover", "cover", [8, 24], 30, "hardy", 90, 300, "Nitrogen-fixing cover crop."),
    C("Vetch", "cover", [8, 22], 28, "hardy", 100, 300, "Nitrogen-fixing winter cover crop."),
    C("Mustard", "cover", [8, 22], 28, "hardy", 60, 250, "Fast cover crop; brassica family."),
    C("Cotton", "cash", [21, 32], 40, "tender", 160, 700, "Long season, deep taproot; heavy feeder."),
    C("Sugarcane", "cash", [22, 34], 40, "tender", 365, 1500, "Year-round canopy but very high water use.", { perennial: true, wet: true }),
    C("Sunflower", "cash", [18, 28], 35, "semi", 110, 450, "Deep-rooting; pulls up nutrients from below."),
    C("Canola", "cash", [8, 22], 28, "hardy", 120, 400, "Brassica oilseed; taproot breaks compaction.", { aliases: ["rapeseed"] }),
    C("Sesame", "cash", [24, 34], 40, "tender", 100, 350, "Drought-tolerant oilseed."),
    C("Cassava", "cash", [22, 32], 38, "tender", 300, 800, "Drought-tolerant root crop for poor soils.", { perennial: true }),
    C("Sweet potato", "vegetable", [20, 30], 36, "tender", 120, 500, "Vines cover the soil quickly and cut erosion."),
    C("Grapes", "fruit", [15, 30], 38, "hardy", 365, 600, "Perennial vine; alley cover crops protect the soil.", { aliases: ["grape"], perennial: true }),
    C("Mango", "fruit", [22, 33], 42, "tender", 365, 900, "Perennial tree; needs a frost-free climate.", { perennial: true }),
    C("Banana", "fruit", [22, 32], 38, "tender", 365, 1500, "Perennial; needs warmth and water all year.", { perennial: true, wet: true }),
    C("Watermelon", "fruit", [21, 32], 38, "tender", 90, 400, "Cucurbit — rotate away from cucumber and pumpkin."),
    C("Strawberry", "fruit", [12, 24], 30, "hardy", 120, 400, "Low-growing; often rotated with brassicas or cereals."),
  ];

  function findCrop(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return null;
    const names = (c) => [c.name.toLowerCase(), ...(c.aliases || [])];
    return (
      CROPS.find((c) => names(c).includes(q)) ||
      CROPS.find((c) => names(c).some((n) => q === n + "s" || q === n + "es" || n === q + "s")) ||
      CROPS.find((c) => names(c).some((n) => q.split(/\s+/).includes(n)))
    );
  }

  /* ---- Monthly climate normals from the real NASA POWER daily record ---- */
  const normalsCache = new WeakMap();
  function monthlyNormals(daily) {
    if (!daily?.T2M) return null;
    if (normalsCache.has(daily)) return normalsCache.get(daily);
    const acc = Array.from({ length: 12 }, () => ({ t: [], tmax: [], tmin: [], wet: [], rain: 0, frost: 0, years: new Set() }));
    const ok = (v) => Number.isFinite(v) && v > -900;
    for (const key of Object.keys(daily.T2M)) {
      const m = Number(key.slice(4, 6)) - 1;
      if (m < 0 || m > 11) continue;
      const a = acc[m];
      a.years.add(key.slice(0, 4));
      const t = Number(daily.T2M[key]);
      const tx = Number(daily.T2M_MAX?.[key]);
      const tn = Number(daily.T2M_MIN?.[key]);
      const r = Number(daily.PRECTOTCORR?.[key]);
      const w = Number(daily.GWETROOT?.[key]);
      if (ok(t)) a.t.push(t);
      if (ok(tx)) a.tmax.push(tx);
      if (ok(tn)) { a.tmin.push(tn); if (tn <= 0) a.frost += 1; }
      if (ok(r)) a.rain += r;
      if (ok(w)) a.wet.push(w);
    }
    const mean = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);
    const normals = acc.map((a, i) => {
      const yrs = Math.max(1, a.years.size);
      return {
        month: i + 1,
        tMean: mean(a.t),
        tMax: mean(a.tmax),
        tMin: mean(a.tmin),
        rain: a.rain / yrs,
        frostDays: a.tmin.length ? a.frost / yrs : null,
        wet: mean(a.wet),
      };
    });
    normalsCache.set(daily, normals);
    return normals;
  }

  /* ---- Suitability check for one crop planted in one month ---- */
  function evaluateCrop(crop, month, normals) {
    const issues = []; // { level: "fail" | "risk" | "water" | "ok", text }
    let window;
    if (crop.perennial) {
      window = normals.slice();
    } else {
      const n = Math.max(1, Math.round(crop.days / 30));
      window = Array.from({ length: Math.min(12, n) }, (_, i) => normals[(month - 1 + i) % 12]);
    }
    const valid = window.filter((m) => m.tMean != null);
    if (!valid.length) return null;

    // Temperature — for perennials, judge the six warmest months (the growing season)
    const tempMonths = crop.perennial ? valid.slice().sort((a, b) => b.tMean - a.tMean).slice(0, 6) : valid;
    const tMean = tempMonths.reduce((s, m) => s + m.tMean, 0) / tempMonths.length;
    const [lo, hi] = crop.opt;
    const tText = `average ${tMean.toFixed(1)}°C over the ${crop.perennial ? "six warmest months" : "growing window"} (likes ${lo}–${hi}°C)`;
    if (tMean < lo - 3) issues.push({ level: "fail", text: `Too cold: ${tText}.` });
    else if (tMean < lo) issues.push({ level: "risk", text: `On the cool side: ${tText} — slow growth likely.` });
    else if (tMean > hi + 3) issues.push({ level: "fail", text: `Too hot: ${tText}.` });
    else if (tMean > hi) issues.push({ level: "risk", text: `On the warm side: ${tText}.` });
    else issues.push({ level: "ok", text: `Temperature fits: ${tText}.` });

    // Heat spikes
    const hottest = valid.reduce((a, b) => (b.tMax != null && (a == null || b.tMax > a.tMax) ? b : a), null);
    if (hottest?.tMax != null) {
      if (hottest.tMax > crop.hot + 4) issues.push({ level: "fail", text: `Heat damage likely: daily highs average ${hottest.tMax.toFixed(1)}°C in ${MONTHS[hottest.month - 1]} (limit about ${crop.hot}°C).` });
      else if (hottest.tMax > crop.hot) issues.push({ level: "risk", text: `Heat stress possible: daily highs average ${hottest.tMax.toFixed(1)}°C in ${MONTHS[hottest.month - 1]} (limit about ${crop.hot}°C).` });
    }

    // Frost
    const frost = valid.reduce((s, m) => s + (m.frostDays || 0), 0);
    const frostText = `about ${frost < 1 ? frost.toFixed(1) : Math.round(frost)} frost day${frost >= 1.5 ? "s" : ""} ${crop.perennial ? "per year" : "in the growing window"}`;
    if (crop.frost === "tender") {
      if (frost > 2) issues.push({ level: "fail", text: `Frost kills this crop: ${frostText}.` });
      else if (frost > 0.3) issues.push({ level: "risk", text: `Frost risk: ${frostText} — this crop is frost-tender.` });
      else issues.push({ level: "ok", text: "No frost expected in the growing window." });
    } else if (crop.frost === "semi") {
      if (frost > 25) issues.push({ level: "fail", text: `Too much frost: ${frostText}; it only tolerates light frost.` });
      else if (frost > 8) issues.push({ level: "risk", text: `Frost risk: ${frostText}; it only tolerates light frost.` });
    } else if (crop.perennial) {
      const warm = normals.filter((m) => m.tMean != null && m.tMean >= 10).length;
      if (warm < 4) issues.push({ level: "fail", text: `Growing season too short: only ${warm} months average 10°C or more.` });
      else if (warm < 6) issues.push({ level: "risk", text: `Short growing season: ${warm} months average 10°C or more.` });
    }

    // Water
    const rain = valid.reduce((s, m) => s + m.rain, 0);
    const ratio = rain / crop.water;
    const wText = `about ${Math.round(rain)} mm of rain ${crop.perennial ? "per year" : "in the window"} vs. roughly ${crop.water} mm needed`;
    if (ratio < 0.4) issues.push({ level: "risk", text: `Far too little rain: ${wText} — only works with reliable irrigation.` });
    else if (ratio < 0.8) issues.push({ level: "water", text: `Rain falls short: ${wText} — plan for about ${Math.round(crop.water - rain)} mm of irrigation.` });
    else if (ratio > 3.5 && !crop.wet) issues.push({ level: "risk", text: `Very wet: ${wText} — waterlogging and disease pressure likely; needs good drainage.` });
    else issues.push({ level: "ok", text: `Rainfall is enough: ${wText}.` });

    const has = (lvl) => issues.some((i) => i.level === lvl);
    const verdict = has("fail") ? "no" : has("risk") ? "risky" : has("water") ? "water" : "yes";
    return { verdict, issues, tMean, rain, frost, windowMonths: valid.map((m) => m.month) };
  }

  const VERDICT_LABEL = { yes: "Suitable", water: "Suitable with irrigation", risky: "Risky", no: "Not suitable" };

  // "Apr–Jun, Sep" style list of the planting months that pass.
  function goodMonths(crop, normals) {
    const good = [];
    for (let m = 1; m <= 12; m++) {
      const r = evaluateCrop(crop, m, normals);
      if (r && (r.verdict === "yes" || r.verdict === "water")) good.push(m);
    }
    return good;
  }
  function monthRanges(months) {
    if (!months.length) return "";
    if (months.length === 12) return "any month";
    const runs = [];
    let start = months[0];
    let prev = months[0];
    for (let i = 1; i <= months.length; i++) {
      const m = months[i];
      if (m === prev + 1) { prev = m; continue; }
      runs.push(start === prev ? MONTHS[start - 1] : `${MONTHS[start - 1]}–${MONTHS[prev - 1]}`);
      start = m;
      prev = m;
    }
    return runs.join(", ");
  }

  /* ==================== Crop search UI ==================== */
  const cropForm = qs("#cropSearchForm");
  const cropQuery = qs("#cropQuery");
  const cropDate = qs("#cropDate");
  const cropResult = qs("#cropResult");
  const plantNow = qs("#plantNow");
  const cropPlace = qs("#cropPlace");
  const cropList = qs("#cropList");
  const cropBtn = qs("#cropCheckBtn");
  let lastCropCheck = null;
  let cropRequestId = 0;

  if (cropList) cropList.innerHTML = CROPS.map((c) => `<option value="${esc(c.name)}"></option>`).join("");
  if (cropDate) {
    const now = new Date();
    cropDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  const DATA_NOTE = "Based on the NASA POWER daily record for 2023–2024 at this place (about a 50 km grid cell) and general crop reference ranges. Two years is a short record, and your soil, variety and irrigation are not known here — confirm with a local agronomist.";

  function renderCropResult(html, verdict) {
    cropResult.hidden = false;
    cropResult.className = `crop-result${verdict ? ` v-${verdict}` : ""}`;
    cropResult.innerHTML = html;
  }

  function issueList(issues) {
    const icon = { ok: "✓", water: "~", risk: "!", fail: "✕" };
    return `<ul class="cr-issues">${issues.map((i) => `<li class="cr-${i.level}"><span aria-hidden="true">${icon[i.level]}</span>${esc(i.text)}</li>`).join("")}</ul>`;
  }

  async function checkCrop(rawName, dateStr) {
    const name = (rawName || "").trim();
    if (!name || !dateStr || !cropResult) return;
    const reqId = ++cropRequestId;
    const loc = state.getLocation();
    const place = shortPlace(loc.name);
    const d = new Date(`${dateStr}T00:00:00`);
    const month = d.getMonth() + 1;
    const dateLabel = d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
    const normals = monthlyNormals(state.getDaily());

    if (!normals) {
      renderCropResult(`<p class="cr-wait">Still loading the NASA POWER climate record for ${esc(place)} — try again in a few seconds.</p>`);
      return;
    }

    const crop = findCrop(name);
    if (crop) {
      const r = evaluateCrop(crop, month, normals);
      const good = goodMonths(crop, normals);
      const windowText = crop.perennial
        ? "Perennial crop — judged on the whole year, so the planting date matters less than the climate."
        : `Growing window: ${MONTHS[r.windowMonths[0] - 1]}–${MONTHS[r.windowMonths[r.windowMonths.length - 1] - 1]} (about ${crop.days} days).`;
      const better = good.length
        ? good.includes(month) && !crop.perennial
          ? `Planting months that pass here: <strong>${monthRanges(good)}</strong>.`
          : crop.perennial
            ? ""
            : `Better planting months here: <strong>${monthRanges(good)}</strong>.`
        : "No planting month passes for this crop at this place without protection (greenhouse, irrigation or a different variety).";
      lastCropCheck = {
        crop: crop.name, planting_date: dateStr, place, verdict: VERDICT_LABEL[r.verdict],
        reasons: r.issues.map((i) => i.text), months_that_pass: monthRanges(good) || "none", source: "built-in reference ranges + NASA POWER record",
      };
      renderCropResult(
        `<div class="cr-head"><span class="cr-badge">${VERDICT_LABEL[r.verdict]}</span><h3>${esc(crop.name)} planted ${esc(dateLabel)} · ${esc(place)}</h3></div>` +
        `<p class="cr-window">${windowText}</p>` +
        issueList(r.issues) +
        (better ? `<p class="cr-better">${better}</p>` : "") +
        `<p class="cr-role"><strong>In a rotation:</strong> ${esc(crop.role)}${crop.note ? ` <em>${esc(crop.note)}</em>` : ""}</p>` +
        `<p class="cr-note">${DATA_NOTE}</p>`,
        r.verdict
      );
      return;
    }

    // Not in the built-in list — ask the AI agronomist, grounded in the same climate record.
    renderCropResult(`<p class="cr-wait">“${esc(name)}” isn't in the built-in list — asking the AI agronomist…</p>`);
    cropBtn.disabled = true;
    try {
      const indicators = await state.getIndicators(loc.lat, loc.lon);
      const res = await fetch(`${state.apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            `Crop suitability check. Crop: "${name}". Planting date: ${dateLabel}. ` +
            "Using the monthly climate normals in the context and your general agronomic knowledge of this crop's temperature, frost and water needs, decide if it suits this place and planting date. " +
            "Reply in exactly this form: first line 'VERDICT: Suitable' or 'VERDICT: Suitable with irrigation' or 'VERDICT: Risky' or 'VERDICT: Not suitable' or 'VERDICT: Unknown crop' (if this is not a real crop). " +
            "Then 2 to 4 short bullet points with the reasons, citing the climate numbers. Then one line starting 'Better months:' if another planting time would suit it better.",
          location_label: loc.name || "the sample farm",
          indicators,
          page_context: climateContext(normals),
        }),
      });
      if (!res.ok) throw new Error(`chat HTTP ${res.status}`);
      const data = await res.json();
      if (reqId !== cropRequestId) return;
      const answer = String(data.answer || "");
      const m = answer.match(/VERDICT:\s*([A-Za-z ]+)/i);
      const label = m ? m[1].trim() : "See notes";
      const key = /unknown/i.test(label) ? "" : /not suitable/i.test(label) ? "no" : /risky/i.test(label) ? "risky" : /irrigation/i.test(label) ? "water" : /suitable/i.test(label) ? "yes" : "";
      const body = esc(answer.replace(/VERDICT:.*\n?/i, "").trim())
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .split("\n").filter((l) => l.trim()).map((l) => `<li>${l.replace(/^\s*[-*•]\s+/, "")}</li>`).join("");
      lastCropCheck = { crop: name, planting_date: dateStr, place, verdict: label, source: "AI estimate (crop not in built-in list)" };
      renderCropResult(
        `<div class="cr-head"><span class="cr-badge">${esc(label)}</span><h3>${esc(name)} planted ${esc(dateLabel)} · ${esc(place)}</h3></div>` +
        '<p class="cr-ai">AI estimate — this crop is not in the built-in reference list, so the answer comes from the AI agronomist reading the same NASA climate record.</p>' +
        `<ul class="cr-issues cr-plain">${body}</ul>` +
        `<p class="cr-note">${DATA_NOTE}</p>`,
        key
      );
    } catch (err) {
      console.error("Crop AI check failed", err);
      if (reqId !== cropRequestId) return;
      renderCropResult(`<p class="cr-wait">“${esc(name)}” isn't in the built-in list and the AI agronomist couldn't be reached. Try again in a moment, or pick a crop from the suggestions.</p>`);
    } finally {
      cropBtn.disabled = false;
    }
  }

  function renderPlantNow() {
    if (!plantNow || !cropDate) return;
    const loc = state.getLocation();
    if (cropPlace) cropPlace.textContent = shortPlace(loc.name);
    const normals = monthlyNormals(state.getDaily());
    if (!normals || !cropDate.value) { plantNow.hidden = true; return; }
    const month = new Date(`${cropDate.value}T00:00:00`).getMonth() + 1;
    const annuals = CROPS.filter((c) => !c.perennial);
    const good = annuals.filter((c) => {
      const r = evaluateCrop(c, month, normals);
      return r && (r.verdict === "yes" || r.verdict === "water");
    });
    plantNow.hidden = false;
    plantNow.innerHTML = good.length
      ? `<p class="pn-label">Passes the check for planting in <strong>${MONTHS[month - 1]}</strong> at ${esc(shortPlace(loc.name))}:</p>` +
        `<div class="pn-chips">${good.map((c) => `<button type="button" class="pn-chip" data-crop="${esc(c.name)}">${esc(c.name)}</button>`).join("")}</div>`
      : `<p class="pn-label">No annual crop in the built-in list passes for planting in <strong>${MONTHS[month - 1]}</strong> at ${esc(shortPlace(loc.name))} — likely too cold, too hot or too dry. Try another month.</p>`;
  }

  cropForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    checkCrop(cropQuery.value, cropDate.value);
  });
  cropDate?.addEventListener("change", () => {
    renderPlantNow();
    if (cropQuery.value.trim()) checkCrop(cropQuery.value, cropDate.value);
  });
  plantNow?.addEventListener("click", (e) => {
    const chip = e.target.closest(".pn-chip");
    if (!chip) return;
    cropQuery.value = chip.dataset.crop;
    checkCrop(chip.dataset.crop, cropDate.value);
  });
  const tileCheck = (tile) => {
    const name = tile.querySelector("h3")?.textContent.trim();
    if (!name) return;
    cropQuery.value = name;
    checkCrop(name, cropDate.value);
    cropForm.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  qs("#cropGrid")?.addEventListener("click", (e) => {
    const tile = e.target.closest(".crop-tile");
    if (tile) tileCheck(tile);
  });
  qs("#cropGrid")?.addEventListener("keydown", (e) => {
    const tile = e.target.closest(".crop-tile");
    if (tile && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tileCheck(tile); }
  });

  /* ==================== Rotation planner ==================== */
  const rotResults = qs("#rotResults");
  const rotStatus = qs("#rotStatus");
  const rotIndicators = qs("#rotIndicators");
  const rotPlace = qs("#rotPlace");
  const rotRunBtn = qs("#rotRunBtn");
  const sliders = [...document.querySelectorAll(".rot-slider input[type=range]")];
  const presetBtns = [...document.querySelectorAll(".rot-preset")];
  const order = ["soil_health_potential", "water_use_suitability", "climate_resilience", "pest_disease_interruption", "erosion_reduction", "economic_suitability"];
  const PRESETS = {
    balanced: [4, 3, 3, 2, 2, 2],
    water: [2, 5, 4, 1, 2, 1],
    soil: [5, 2, 2, 3, 4, 1],
    income: [2, 2, 2, 2, 1, 5],
  };
  const CRITERIA_LABEL = {
    soil_health_potential: "Soil health",
    water_use_suitability: "Water saving",
    climate_resilience: "Weather resilience",
    pest_disease_interruption: "Pest & disease break",
    erosion_reduction: "Erosion control",
    economic_suitability: "Income & market",
  };
  let lastRotation = null;
  let rotStarted = false;
  let rotRequestId = 0;

  function currentWeights() {
    const w = {};
    sliders.forEach((s) => { w[s.dataset.criterion] = Number(s.value); });
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    return total > 0 ? w : null; // all zero → let the API use its defaults
  }

  function renderIndicators(ind) {
    if (!rotIndicators) return;
    const chips = [];
    const sign = (v) => (v >= 0 ? "+" : "");
    if (ind.temp_anomaly_mean_c != null) chips.push(["Temperature vs. 5-yr normal", `${sign(ind.temp_anomaly_mean_c)}${ind.temp_anomaly_mean_c}°C`]);
    if (ind.longest_dry_spell_days != null) chips.push(["Longest dry spell", `${ind.longest_dry_spell_days} days`]);
    if (ind.extreme_rainfall_days != null) chips.push(["Extreme-rain days", `${ind.extreme_rainfall_days}${ind.extreme_rainfall_threshold_mm != null ? ` (over ${Number(ind.extreme_rainfall_threshold_mm).toFixed(1)} mm)` : ""}`]);
    if (ind.rainfall_anomaly_pct != null) chips.push(["Rainfall vs. normal", `${sign(ind.rainfall_anomaly_pct)}${ind.rainfall_anomaly_pct}%`]);
    rotIndicators.innerHTML =
      '<span class="ri-title">NASA POWER indicators used</span>' +
      chips.map(([k, v]) => `<span class="ri-chip"><small>${esc(k)}</small><strong>${esc(v)}</strong></span>`).join("");
  }

  function listBlock(title, items, cls) {
    if (!items?.length) return "";
    return `<div class="rc-block ${cls}"><h5>${title}</h5><ul>${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  }

  function renderRotation(comparisons) {
    rotResults.innerHTML = comparisons.map((c, i) => {
      const m = String(c.label).match(/^(.*?)\s*\((.*)\)\s*$/);
      const title = m ? m[1] : c.label;
      const seq = (m ? m[2] : "").replace(/\s*->\s*/g, " → ");
      const badges =
        (i === 0 ? '<span class="rc-badge best">Best match for your priorities</span>' : "") +
        (c.strategy === "conventional" ? '<span class="rc-badge existing">Existing rotation</span>' : "");
      const bars = order.map((k) => {
        const v = Number(c.criteria_scores?.[k] ?? 0);
        const real = c.criteria_confidence?.[k] === "real_data";
        return `<div class="rc-bar"><span class="rc-bar-label">${esc(CRITERIA_LABEL[k])}<i class="${real ? "tag-real" : "tag-assume"}">${real ? "NASA data" : "Assumption"}</i></span>` +
          `<span class="rc-track"><span class="rc-fill${real ? " real" : ""}" style="width:${Math.max(2, Math.min(100, v)).toFixed(0)}%"></span></span><span class="rc-val">${Math.round(v)}</span></div>`;
      }).join("");
      return `<article class="rot-card${i === 0 ? " top" : ""}">
        <header class="rc-head">
          <span class="rc-rank">#${i + 1}</span>
          <div class="rc-title"><h4>${esc(title)}</h4><p>${esc(seq)}</p><div class="rc-badges">${badges}</div></div>
          <div class="rc-score"><strong>${Math.round(c.overall_score)}</strong><small>/100</small></div>
        </header>
        <div class="rc-bars">${bars}</div>
        <details class="rc-details"${i === 0 ? " open" : ""}>
          <summary>Why, benefits, gaps and risks</summary>
          ${listBlock("Why it scored this way — the evidence", c.evidence, "ev")}
          ${listBlock("Benefits it may offer", c.benefits, "be")}
          ${listBlock("Information gaps", c.information_gaps, "ga")}
          ${listBlock("Risks to review with a local expert", c.risks, "ri")}
        </details>
      </article>`;
    }).join("");
  }

  async function runRotation() {
    if (!rotResults) return;
    rotStarted = true;
    const reqId = ++rotRequestId;
    const loc = state.getLocation();
    if (rotPlace) rotPlace.textContent = shortPlace(loc.name);
    rotStatus.textContent = "Fetching NASA climate indicators…";
    rotRunBtn.disabled = true;
    try {
      const indicators = await state.getIndicators(loc.lat, loc.lon);
      if (reqId !== rotRequestId) return;
      renderIndicators(indicators);
      rotStatus.textContent = "Scoring the three strategies…";
      const weights = currentWeights();
      const res = await fetch(`${state.apiBase}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights ? { indicators, weights } : { indicators }),
      });
      if (!res.ok) throw new Error(`score HTTP ${res.status}`);
      const data = await res.json();
      if (reqId !== rotRequestId) return;
      renderRotation(data.comparisons || []);
      lastRotation = {
        place: shortPlace(loc.name),
        farmer_priorities_0_to_5: Object.fromEntries(order.map((k) => [CRITERIA_LABEL[k], Number(sliders.find((s) => s.dataset.criterion === k)?.value ?? 0)])),
        ranking: (data.comparisons || []).map((c, i) => `${i + 1}. ${c.label} — ${Math.round(c.overall_score)}/100`),
      };
      rotStatus.textContent = `Ranked for ${shortPlace(loc.name)}.`;
    } catch (err) {
      console.error("Rotation planner failed", err);
      if (reqId !== rotRequestId) return;
      rotStatus.textContent = "";
      rotResults.innerHTML = '<p class="rot-empty">Couldn\'t reach the AGROINTEL AI scoring service just now. Check your connection and press “Compare for the map location” again.</p>';
    } finally {
      if (reqId === rotRequestId) rotRunBtn.disabled = false;
    }
  }

  let rotTimer = null;
  const scheduleRotation = () => {
    clearTimeout(rotTimer);
    rotTimer = setTimeout(runRotation, 350);
  };
  sliders.forEach((s) => {
    s.addEventListener("input", () => {
      const out = qs(`#o_${s.dataset.criterion}`);
      if (out) out.textContent = s.value;
      presetBtns.forEach((b) => b.classList.remove("active"));
      scheduleRotation();
    });
  });
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const vals = PRESETS[btn.dataset.preset];
      if (!vals) return;
      order.forEach((k, i) => {
        const s = sliders.find((x) => x.dataset.criterion === k);
        if (!s) return;
        s.value = vals[i];
        const out = qs(`#o_${k}`);
        if (out) out.textContent = vals[i];
      });
      presetBtns.forEach((b) => b.classList.toggle("active", b === btn));
      scheduleRotation();
    });
  });
  rotRunBtn?.addEventListener("click", runRotation);

  // First run when the planner scrolls near the viewport (saves an API
  // call for visitors who never reach it).
  const rotSection = qs("#rotation");
  if (rotSection && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        io.disconnect();
        if (!rotStarted) runRotation();
      }
    }, { rootMargin: "300px 0px" });
    io.observe(rotSection);
  } else if (rotSection) {
    runRotation();
  }

  /* ---- Follow the map: new place or newly loaded climate record ---- */
  let lastPlaceKey = "";
  state.onChange(() => {
    const loc = state.getLocation();
    const key = `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
    renderPlantNow();
    if (cropQuery?.value.trim() && !cropResult.hidden && monthlyNormals(state.getDaily())) checkCrop(cropQuery.value, cropDate.value);
    if (key !== lastPlaceKey) {
      lastPlaceKey = key;
      if (rotPlace) rotPlace.textContent = shortPlace(loc.name);
      if (rotStarted) runRotation();
    }
  });
  renderPlantNow();

  /* ---- Context handed to Ask Agro with every question ---- */
  function climateContext(normals) {
    const rows = normals.map((m) =>
      `${MONTHS[m.month - 1]}: mean ${m.tMean?.toFixed(1)}C, avg high ${m.tMax?.toFixed(1)}C, avg low ${m.tMin != null ? m.tMin.toFixed(1) + "C" : "n/a"}, rain ${Math.round(m.rain)} mm, frost days ${m.frostDays != null ? m.frostDays.toFixed(1) : "n/a"}, root-zone wetness ${m.wet != null ? m.wet.toFixed(2) : "n/a"}`
    );
    return "MONTHLY CLIMATE NORMALS FOR THIS PLACE (real NASA POWER daily record, 2023-2024 only):\n" + rows.join("\n");
  }

  window.AgroPlanner = {
    getAiContext() {
      const normals = monthlyNormals(state.getDaily());
      if (!normals) return "";
      const parts = [climateContext(normals)];
      const month = new Date(`${state.getDate()}T00:00:00`).getMonth() + 1;
      const windows = CROPS.filter((c) => !c.perennial).map((c) => {
        const good = goodMonths(c, normals);
        return `${c.name}: ${good.length ? monthRanges(good) : "no month passes"}`;
      });
      parts.push(
        `PLANTING WINDOWS AT THIS PLACE (months where each crop passes the page's temperature/frost/rain check; built-in general reference ranges, not local trials; map date is in ${MONTHS[month - 1]}):\n` +
        windows.join("; ")
      );
      if (lastCropCheck) parts.push("LAST CROP SUITABILITY CHECK ON THE PAGE:\n" + JSON.stringify(lastCropCheck, null, 1));
      if (lastRotation) parts.push("ROTATION PLANNER STATE ON THE PAGE:\n" + JSON.stringify(lastRotation, null, 1));
      return parts.join("\n\n");
    },
  };
})();
