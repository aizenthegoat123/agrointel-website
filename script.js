/* Crop Rotation Explorer – Main Script */

// Study location: near Ames, Iowa
const FARM_LAT = 42.0308;
const FARM_LON = -93.6319;

// ===== Map Setup =====
const map = L.map('map', {
  center: [FARM_LAT, FARM_LON],
  zoom: 10,
  zoomControl: true,
  maxZoom: 18
});

// Base layers
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
});

const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri',
    maxZoom: 18
  }
);

// Start with satellite base (clearer for agriculture)
esriSat.addTo(map);

// NASA GIBS – official working template from nasa-gibs examples
function createGibsLayer(layerName, dateStr, format = 'jpg') {
  const template =
    `https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{time}/{tileMatrixSet}/{z}/{y}/{x}.${format}`;

  return L.tileLayer(template, {
    layer: layerName,
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    time: dateStr,
    tileSize: 256,
    subdomains: 'abc',
    maxZoom: 9,
    // Single-day MODIS/VIIRS imagery has real satellite-orbit swath gaps
    // (visible as black "teeth") that show up once the view is wide enough
    // to see them. Below this zoom, the complete Esri satellite basemap
    // shows through instead rather than a broken-looking overlay.
    minZoom: 5,
    opacity: 0.75,
    noWrap: false,
    bounds: [
      [-85.0511287776, -179.999999975],
      [85.0511287776, 179.999999975]
    ],
    attribution: 'Imagery © <a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a>',
    errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  });
}

// Layer definitions (name → format)
const gibsLayers = {
  'MODIS_Terra_CorrectedReflectance_TrueColor': 'jpg',
  'MODIS_Aqua_CorrectedReflectance_TrueColor': 'jpg',
  'VIIRS_SNPP_CorrectedReflectance_TrueColor': 'jpg',
  'MODIS_Terra_NDVI_8Day': 'png',
  'MODIS_Terra_Land_Surface_Temp_Day': 'png',
  'MODIS_Terra_CorrectedReflectance_Bands721': 'jpg'
};

let currentGibs = null;
const markers = [];

function updateGibsLayer() {
  const layerName = document.getElementById('gibs-layer').value;
  const dateStr = document.getElementById('gibs-date').value || '2025-07-15';
  const format = gibsLayers[layerName] || 'jpg';

  if (currentGibs) {
    map.removeLayer(currentGibs);
  }

  currentGibs = createGibsLayer(layerName, dateStr, format);
  currentGibs.addTo(map);

  // Bring markers to front
  markers.forEach(m => m.bringToFront());
}

// Base layer switcher
document.getElementById('base-layer')?.addEventListener('change', (e) => {
  const val = e.target.value;
  if (val === 'osm') {
    map.removeLayer(esriSat);
    osm.addTo(map);
  } else {
    map.removeLayer(osm);
    esriSat.addTo(map);
  }
  if (currentGibs) currentGibs.bringToFront();
});

// NASA Layer and Date apply immediately on change - no separate Update
// step needed (opacity already worked this way via the 'input' listener
// below; this makes the other two controls consistent with it).
document.getElementById('gibs-layer')?.addEventListener('change', updateGibsLayer);
document.getElementById('gibs-date')?.addEventListener('change', updateGibsLayer);

document.getElementById('locate-farm').addEventListener('click', () => {
  map.setView([FARM_LAT, FARM_LON], 12);
});

// Opacity control
document.getElementById('layer-opacity')?.addEventListener('input', (e) => {
  if (currentGibs) {
    currentGibs.setOpacity(parseFloat(e.target.value));
  }
});

// Initial GIBS layer
updateGibsLayer();

// Sample field markers – new stronger colors
const fields = [
  {
    lat: 42.041,
    lon: -93.645,
    name: 'North Field – Corn (2024)',
    type: 'corn',
    note: 'Typical continuous corn phase. Watch for bare soil after harvest and summer heat stress windows.'
  },
  {
    lat: 42.018,
    lon: -93.618,
    name: 'South Field – Soybean (2024)',
    type: 'soy',
    note: 'Soybean phase. Short rotation increases SCN risk. Consider small grain or cover after harvest.'
  },
  {
    lat: 42.035,
    lon: -93.602,
    name: 'East Block – Diversification Candidate',
    type: 'cover',
    note: 'Good candidate for winter wheat or oats + cover crop. Improves infiltration and breaks pest cycles.'
  }
];

const iconColors = {
  corn: '#e67e22',      // strong orange
  soy: '#27ae60',       // fresh green
  cover: '#f1c40f'      // bright gold
};

fields.forEach(f => {
  const marker = L.circleMarker([f.lat, f.lon], {
    radius: 11,
    fillColor: iconColors[f.type],
    color: '#ffffff',
    weight: 3,
    opacity: 1,
    fillOpacity: 0.95
  }).addTo(map);

  marker.bindPopup(`
    <strong style="font-size:1.05em">${f.name}</strong><br>
    ${f.note}<br>
    <small style="color:#666">Lat ${f.lat.toFixed(3)}, Lon ${f.lon.toFixed(3)}</small>
  `);

  markers.push(marker);
});


// ===== Real Suitability Index grid (replaces the old illustrative zones) =====
// See the dedicated "Suitability Index" block further down for the
// implementation (grid sampling, real /indicators + /score fetches,
// classification, and rendering). It's wired up after FARM_LAT/FARM_LON
// and the AGROINTEL AI constants are defined.

// ===== Season timeline =====
const seasonNotes = [
  'Spring: planting window, frost risk in low spots, soil often wet.',
  'Early summer: canopy building, good moisture window if rains arrive on time.',
  'Peak summer: higher heat stress and soil-moisture drawdown risk.',
  'Fall: harvest and bare-soil window — erosion risk rises with intense rain.'
];

document.getElementById('season-slider')?.addEventListener('input', (e) => {
  const i = parseInt(e.target.value, 10);
  const note = document.getElementById('season-note');
  if (note) note.textContent = seasonNotes[i] || '';
});

// ===== Scenario sliders (illustrative what-if) =====
function updateScenarioNote() {
  const rain = parseInt(document.getElementById('rain-slider')?.value || 0, 10);
  const temp = parseFloat(document.getElementById('temp-slider')?.value || 0);
  const rainEl = document.getElementById('rain-val');
  const tempEl = document.getElementById('temp-val');
  const note = document.getElementById('scenario-note');
  if (rainEl) rainEl.textContent = (rain > 0 ? '+' : '') + rain + '%';
  if (tempEl) tempEl.textContent = (temp > 0 ? '+' : '') + temp + '°C';

  let msg = 'Current climate baseline for the sample area.';
  if (rain < -10 && temp > 1) {
    msg = 'Drier + warmer: higher water-stress risk. Cover crops and deeper-rooted rotations become more valuable.';
  } else if (rain < -10) {
    msg = 'Drier conditions: focus on infiltration and residual moisture. Avoid long bare periods.';
  } else if (temp > 1.5) {
    msg = 'Warmer peak season: heat stress on corn rises. Living cover and soil organic matter can help.';
  } else if (rain > 15) {
    msg = 'Wetter pattern: erosion and ponding risk increase on bare ground. Keep residue and living cover.';
  } else if (rain !== 0 || temp !== 0) {
    msg = 'Mild shift from baseline. Still worth discussing cover and diversification with your advisor.';
  }
  if (note) note.textContent = msg;
}

document.getElementById('rain-slider')?.addEventListener('input', updateScenarioNote);
document.getElementById('temp-slider')?.addEventListener('input', updateScenarioNote);


// ===== Tabs =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ===== NASA POWER Data + Charts =====
let precipChart = null;
let tempChart = null;

async function loadNasaPower() {
  const status = document.getElementById('power-status');
  status.textContent = 'Fetching NASA POWER data…';

  // Two years of daily data (AG community)
  const start = '20230101';
  const end = '20241231';
  const params = 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR';
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${params}&community=AG&longitude=${FARM_LON}&latitude=${FARM_LAT}&start=${start}&end=${end}&format=JSON`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const paramsData = json.properties.parameter;
    const dates = Object.keys(paramsData.T2M).sort();

    // Aggregate to monthly for clearer charts
    const monthly = {};
    dates.forEach(d => {
      const ym = d.substring(0, 6); // YYYYMM
      if (!monthly[ym]) {
        monthly[ym] = { precip: 0, tmean: [], tmax: [], tmin: [], count: 0 };
      }
      const p = paramsData.PRECTOTCORR[d];
      const t = paramsData.T2M[d];
      const tx = paramsData.T2M_MAX[d];
      const tn = paramsData.T2M_MIN[d];
      if (p !== undefined && p > -900) monthly[ym].precip += p;
      if (t !== undefined && t > -900) monthly[ym].tmean.push(t);
      if (tx !== undefined && tx > -900) monthly[ym].tmax.push(tx);
      if (tn !== undefined && tn > -900) monthly[ym].tmin.push(tn);
      monthly[ym].count++;
    });

    const labels = Object.keys(monthly).sort().map(ym => {
      const y = ym.substring(0, 4);
      const m = ym.substring(4, 6);
      return `${y}-${m}`;
    });

    const precipVals = Object.keys(monthly).sort().map(ym =>
      Math.round(monthly[ym].precip * 10) / 10
    );

    const tmeanVals = Object.keys(monthly).sort().map(ym => {
      const arr = monthly[ym].tmean;
      return arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
    });
    const tmaxVals = Object.keys(monthly).sort().map(ym => {
      const arr = monthly[ym].tmax;
      return arr.length ? Math.round(Math.max(...arr) * 10) / 10 : null;
    });
    const tminVals = Object.keys(monthly).sort().map(ym => {
      const arr = monthly[ym].tmin;
      return arr.length ? Math.round(Math.min(...arr) * 10) / 10 : null;
    });

    // Destroy previous charts if any
    if (precipChart) precipChart.destroy();
    if (tempChart) tempChart.destroy();

    // Precipitation chart
    const ctxP = document.getElementById('precip-chart').getContext('2d');
    precipChart = new Chart(ctxP, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Monthly Precipitation (mm)',
          data: precipVals,
          backgroundColor: 'rgba(74, 144, 164, 0.7)',
          borderColor: 'rgba(74, 144, 164, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'mm' } }
        }
      }
    });

    // Temperature chart
    const ctxT = document.getElementById('temp-chart').getContext('2d');
    tempChart = new Chart(ctxT, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Max',
            data: tmaxVals,
            borderColor: '#e76f51',
            backgroundColor: 'transparent',
            tension: 0.2,
            pointRadius: 2
          },
          {
            label: 'Mean',
            data: tmeanVals,
            borderColor: '#2a9d8f',
            backgroundColor: 'transparent',
            tension: 0.2,
            pointRadius: 2
          },
          {
            label: 'Min',
            data: tminVals,
            borderColor: '#4a90a4',
            backgroundColor: 'transparent',
            tension: 0.2,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: { title: { display: true, text: '°C' } }
        }
      }
    });

    status.textContent = `Loaded ${dates.length} days of NASA POWER data for ${FARM_LAT.toFixed(2)}°N, ${Math.abs(FARM_LON).toFixed(2)}°W.`;
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not load live data (network or CORS). Showing illustrative patterns instead.';
    // Fallback demo data
    renderFallbackCharts();
  }
}

function renderFallbackCharts() {
  const labels = ['2023-01','2023-04','2023-07','2023-10','2024-01','2024-04','2024-07','2024-10'];
  const precip = [25, 80, 110, 55, 30, 95, 130, 60];
  const tmean = [-5, 10, 24, 12, -4, 11, 25, 13];
  const tmax = [2, 18, 32, 20, 3, 19, 33, 21];
  const tmin = [-12, 2, 16, 4, -11, 3, 17, 5];

  if (precipChart) precipChart.destroy();
  if (tempChart) tempChart.destroy();

  precipChart = new Chart(document.getElementById('precip-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Illustrative Precip (mm)',
        data: precip,
        backgroundColor: 'rgba(74, 144, 164, 0.7)'
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  tempChart = new Chart(document.getElementById('temp-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Max', data: tmax, borderColor: '#e76f51', tension: 0.2 },
        { label: 'Mean', data: tmean, borderColor: '#2a9d8f', tension: 0.2 },
        { label: 'Min', data: tmin, borderColor: '#4a90a4', tension: 0.2 }
      ]
    },
    options: { responsive: true }
  });
}

document.getElementById('load-power').addEventListener('click', loadNasaPower);

// Auto-load on page ready (optional)
document.addEventListener('DOMContentLoaded', () => {
  // Small delay so map is ready
  setTimeout(() => {
    // Uncomment next line if you want auto-fetch
    // loadNasaPower();
  }, 800);
});


// ===== Farmer Priorities (Farmer-Centered Design) =====
const PRIORITY_MAP = {
  'water-scarce': {
    text: 'Limited water / dry spells',
    favors: ['diverse', 'soil'],
    note: 'Rotations with deeper roots or better cover can help hold moisture.'
  },
  'heavy-rain': {
    text: 'Heavy rain & erosion',
    favors: ['diverse', 'soil'],
    note: 'Keeping living cover longer reduces runoff and soil loss.'
  },
  'heat-stress': {
    text: 'Summer heat stress',
    favors: ['diverse', 'soil'],
    note: 'Better soil cover and organic matter can moderate surface heat.'
  },
  'limited-equip': {
    text: 'Limited equipment',
    favors: ['current'],
    note: 'Starting with the simplest change (e.g. one cover crop) is often practical.'
  },
  'labor-tight': {
    text: 'Tight labor',
    favors: ['current', 'diverse'],
    note: 'Avoid systems that need extra specialized labor until you are ready.'
  },
  'no-till': {
    text: 'Prefer no-till',
    favors: ['diverse', 'soil'],
    note: 'Diverse rotations pair well with no-till for soil structure.'
  },
  'grain-market': {
    text: 'Strong grain markets',
    favors: ['current', 'diverse'],
    note: 'Corn–soy remains strong; adding a small grain can still fit.'
  },
  'forage-market': {
    text: 'Hay / livestock markets',
    favors: ['soil'],
    note: 'Forage or alfalfa phases become more realistic with a market.'
  },
  'cash-flow': {
    text: 'Need steady cash flow',
    favors: ['current', 'diverse'],
    note: 'Multi-year forage can delay income — plan carefully with your advisor.'
  },
  'build-om': {
    text: 'Build organic matter',
    favors: ['soil', 'diverse'],
    note: 'Living roots and residue are the main drivers of soil organic matter.'
  },
  'break-pests': {
    text: 'Break pest cycles',
    favors: ['diverse', 'soil'],
    note: 'A third crop or longer break is often the most effective lever.'
  },
  'n-fix': {
    text: 'Reduce synthetic N',
    favors: ['soil', 'diverse'],
    note: 'Legumes and residual N capture can lower fertilizer needs over time.'
  }
};

const STRATEGY_NAMES = {
  current: 'Existing Corn–Soy',
  diverse: 'Diversified + Small Grain / Cover',
  soil: 'Soil-Building + Forage / Alfalfa'
};

document.getElementById('apply-priorities')?.addEventListener('click', () => {
  const checked = [...document.querySelectorAll('input[name="priority"]:checked')].map(el => el.value);
  const resultBox = document.getElementById('priority-result');
  const summary = document.getElementById('priority-summary');
  const chips = document.getElementById('priority-suggestions');

  if (checked.length === 0) {
    summary.textContent = 'Please select at least one priority so we can highlight matching ideas.';
    chips.innerHTML = '';
    resultBox.hidden = false;
    return;
  }

  // Score strategies
  const scores = { current: 0, diverse: 0, soil: 0 };
  const notes = [];

  checked.forEach(key => {
    const info = PRIORITY_MAP[key];
    if (!info) return;
    info.favors.forEach(s => scores[s]++);
    notes.push(info.note);
  });

  // Rank
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score, name: STRATEGY_NAMES[id] }));

  const top = ranked[0];
  const second = ranked[1];

  let msg = `You selected ${checked.length} priority area(s). `;
  if (top.score > 0) {
    msg += `The ideas that line up most closely are <strong>${top.name}</strong>`;
    if (second && second.score > 0 && second.score >= top.score - 1) {
      msg += ` and <strong>${second.name}</strong>`;
    }
    msg += '.';
  } else {
    msg += 'All three rotation options remain worth discussing.';
  }

  summary.innerHTML = msg;

  chips.innerHTML = ranked
    .filter(r => r.score > 0)
    .map((r, i) => `<span class="chip ${i === 0 ? 'best' : ''}">${r.name}</span>`)
    .join('');

  // Add unique notes
  const uniqueNotes = [...new Set(notes)].slice(0, 3);
  if (uniqueNotes.length) {
    summary.innerHTML += '<br><br><em>Quick takeaways:</em> ' + uniqueNotes.join(' ');
  }

  resultBox.hidden = false;
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

document.getElementById('reset-priorities')?.addEventListener('click', () => {
  document.querySelectorAll('input[name="priority"]').forEach(el => el.checked = false);
  document.getElementById('priority-result').hidden = true;
});



// ===== Place search (Nominatim) =====
async function searchPlace(query) {
  if (!query || !query.trim()) return null;
  // polygon_geojson=1 gets the real boundary shape (not just a bounding
  // box) so the SI heatmap can be clipped to real territory instead of a
  // rectangle; polygon_threshold simplifies it so a detailed coastline
  // doesn't become a huge, slow-to-render geometry.
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&polygon_geojson=1&polygon_threshold=0.01`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (data && data[0]) {
      // boundingbox is [south, north, west, east] as strings
      const bb = data[0].boundingbox ? data[0].boundingbox.map(Number) : null;
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        name: data[0].display_name,
        boundingBox: bb ? { south: bb[0], north: bb[1], west: bb[2], east: bb[3] } : null,
        geometry: data[0].geojson || null
      };
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

// Fits the map to a search result's real shape (if Nominatim returned
// boundary geometry) instead of a fixed zoom level, and draws the real
// outline so the border/coastline shown is accurate, not inferred.
function siFocusOnSearchResult(result) {
  siBoundaryLayer.clearLayers();
  if (result.geometry) {
    const outline = L.geoJSON(result.geometry, {
      style: { color: '#ffffff', weight: 2, fill: false, opacity: 0.9 }
    });
    outline.addTo(siBoundaryLayer);
    map.fitBounds(outline.getBounds(), { padding: [20, 20] });
  } else {
    map.setView([result.lat, result.lon], 11);
  }
}

document.getElementById('search-place-btn')?.addEventListener('click', async () => {
  const q = document.getElementById('place-search')?.value;
  const result = await searchPlace(q);
  if (result) {
    siFocusOnSearchResult(result);
    L.popup().setLatLng([result.lat, result.lon]).setContent(`<strong>${result.name}</strong>`).openOn(map);
    updateSuitabilityForLocation(result);
  } else {
    alert('Place not found. Try a city or country name.');
  }
});

document.getElementById('place-search')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('search-place-btn')?.click();
});

// ===== Chatbot =====
const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

document.getElementById('chat-toggle')?.addEventListener('click', () => {
  if (chatPanel) chatPanel.hidden = !chatPanel.hidden;
});
document.getElementById('chat-close')?.addEventListener('click', () => {
  if (chatPanel) chatPanel.hidden = true;
});

function addChatMsg(text, who = 'bot') {
  if (!chatMessages) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${who}`;
  div.innerHTML = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setGibsLayerByKeyword(keyword) {
  const select = document.getElementById('gibs-layer');
  if (!select) return false;
  const mapKw = {
    'true color': 'MODIS_Terra_CorrectedReflectance_TrueColor',
    'truecolor': 'MODIS_Terra_CorrectedReflectance_TrueColor',
    'terra': 'MODIS_Terra_CorrectedReflectance_TrueColor',
    'aqua': 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    'viirs': 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    'ndvi': 'MODIS_Terra_NDVI_8Day',
    'vegetation': 'MODIS_Terra_NDVI_8Day',
    'temp': 'MODIS_Terra_Land_Surface_Temp_Day',
    'temperature': 'MODIS_Terra_Land_Surface_Temp_Day',
    'heat': 'MODIS_Terra_Land_Surface_Temp_Day',
    'bands': 'MODIS_Terra_CorrectedReflectance_Bands721',
    'ag': 'MODIS_Terra_CorrectedReflectance_Bands721',
    'rain': 'MODIS_Terra_CorrectedReflectance_TrueColor', // visual proxy
    'wind': 'MODIS_Terra_CorrectedReflectance_TrueColor'
  };
  const key = Object.keys(mapKw).find(k => keyword.includes(k));
  if (key) {
    select.value = mapKw[key];
    updateGibsLayer();
    return mapKw[key];
  }
  return false;
}

function setSuitabilityModel(model) {
  const select = document.getElementById('si-model-select');
  if (!select) return false;
  select.value = model;
  select.dispatchEvent(new Event('change'));
  return true;
}

async function handleChatCommand(raw) {
  const text = (raw || '').trim().toLowerCase();
  if (!text) return;

  // Place search / go to
  if (text.startsWith('go to ') || text.startsWith('search ') || text.startsWith('find ') || text.startsWith('show map of ')) {
    const q = text.replace(/^(go to|search|find|show map of)\s+/i, '');
    addChatMsg(`Searching for <strong>${q}</strong>…`);
    const result = await searchPlace(q);
    if (result) {
      siFocusOnSearchResult(result);
      L.popup().setLatLng([result.lat, result.lon]).setContent(`<strong>${result.name}</strong>`).openOn(map);
      const searchInput = document.getElementById('place-search');
      if (searchInput) searchInput.value = q;
      addChatMsg(`Centered map on <strong>${result.name}</strong>.`);
      updateSuitabilityForLocation(result);
    } else {
      addChatMsg('Sorry, I could not find that place. Try a city or country name.');
    }
    return;
  }

  // Every remaining command below is a short, non-question control phrase
  // (e.g. "show ndvi", "erosion", "rotations"). A real question — one with
  // a "?" or more than a few words, like "what's the best rotation
  // strategy here?" — skips all of these and falls through to the real AI
  // at the end of this function instead of being misread as a command.
  const isNavPhrase = !text.includes('?') && text.split(/\s+/).length <= 4;

  // Center farm
  if (isNavPhrase && (text.includes('center farm') || (text.includes('iowa') && text.includes('farm')) || text === 'home')) {
    map.setView([FARM_LAT, FARM_LON], 12);
    addChatMsg('Centered on the sample farm near Ames, Iowa.');
    return;
  }

  // Layer commands
  if (isNavPhrase && (text.includes('show ndvi') || text.includes('vegetation') || text.includes('greenness'))) {
    setGibsLayerByKeyword('ndvi');
    addChatMsg('Switched to <strong>MODIS NDVI</strong> (vegetation health). Green = more vigorous crops.');
    return;
  }
  if (isNavPhrase && (text.includes('show temp') || text.includes('heat') || text.includes('temperature'))) {
    setGibsLayerByKeyword('temp');
    addChatMsg('Switched to <strong>Land Surface Temperature</strong>. Useful for heat-stress patterns.');
    return;
  }
  if (isNavPhrase && (text.includes('true color') || text.includes('satellite photo') || text.includes('show rain') || text.includes('show wind'))) {
    setGibsLayerByKeyword('true color');
    if (text.includes('rain')) {
      addChatMsg('Showing <strong>True Color</strong> imagery. For rainfall patterns, also check the Climate charts section and the scenario slider (rainfall %). Real-time rain radar is not embedded, but NASA GPM concepts are described in the trends.');
    } else if (text.includes('wind')) {
      addChatMsg('Showing <strong>True Color</strong>. Wind direction is not a GIBS layer here; use local weather services for wind. The map is centered for land/crop view.');
    } else {
      addChatMsg('Switched to <strong>True Color</strong> satellite view.');
    }
    return;
  }
  if (isNavPhrase && (text.includes('bands') || text.includes('agriculture layer'))) {
    setGibsLayerByKeyword('bands');
    addChatMsg('Switched to <strong>MODIS Bands 7-2-1</strong> (useful agriculture false-color view).');
    return;
  }

  // Suitability Index model switching (real data, not illustrative)
  if (isNavPhrase && text.includes('erosion')) {
    setSuitabilityModel('erosion');
    addChatMsg('Switched the map to the real <strong>Erosion Risk</strong> model, computed from real rainfall data for the area shown.');
    return;
  }
  if (isNavPhrase && (text.includes('water stress') || text.includes('water-stress') || text.includes('drought'))) {
    setSuitabilityModel('water');
    addChatMsg('Switched the map to the real <strong>Water Stress</strong> model, computed from real dry-spell and temperature data.');
    return;
  }
  if (isNavPhrase && (text.includes('suitability') || text.includes('overall score'))) {
    setSuitabilityModel('suitability');
    addChatMsg('Switched the map to the real <strong>Overall Suitability</strong> model (best rotation strategy score per area).');
    return;
  }

  // Sections navigation
  if (isNavPhrase && text.includes('priorit')) {
    document.getElementById('priorities')?.scrollIntoView({ behavior: 'smooth' });
    addChatMsg('Scrolled to <strong>Your Farm Priorities</strong>. Tick what matters on your farm.');
    return;
  }
  if (isNavPhrase && (text.includes('rotation') || text.includes('strateg'))) {
    document.getElementById('strategies')?.scrollIntoView({ behavior: 'smooth' });
    addChatMsg('Scrolled to <strong>Rotation Strategies</strong>. Compare Corn–Soy, Diversified, and Soil-Building options.');
    return;
  }
  if (isNavPhrase && (text.includes('climate') || text.includes('chart') || text.includes('rainfall') || text.includes('temperature data'))) {
    document.getElementById('climate')?.scrollIntoView({ behavior: 'smooth' });
    addChatMsg('Scrolled to <strong>Climate & Soil</strong>. Click “Load NASA POWER Data” for real temperature and precipitation.');
    return;
  }
  if (isNavPhrase && text.includes('map')) {
    document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
    addChatMsg('Scrolled to the <strong>map</strong>. You can search any place, change layers, and toggle risk overlays.');
    return;
  }

  // Help / about
  if (isNavPhrase && (text.includes('help') || text === '?' || text.includes('what can you'))) {
    addChatMsg(`I can control this page. Try:<br>
      • <em>go to [place]</em> — e.g. "go to Nebraska"<br>
      • <em>show NDVI</em> / <em>show temperature</em> / <em>true color</em><br>
      • <em>show erosion</em> / <em>water stress</em> / <em>suitability</em> (real Suitability Index models)<br>
      • <em>center farm</em><br>
      • <em>rotations</em> / <em>priorities</em> / <em>climate</em><br>
      Ask about crop rotations or soil health too.`);
    return;
  }

  // Anything else is a real question for the AGROINTEL AI assistant,
  // grounded in this farm's real NASA-derived indicators.
  await askAgrointelAi(raw);
}

// ===== AGROINTEL AI (real, Gemini-backed, grounded in real NASA data) =====
const AGROINTEL_API_BASE = 'https://agrointel-ai-api.vercel.app';
const AGROINTEL_LOCATION_LABEL = 'Central Iowa, USA (Ames area)';

// Indicators only depend on the farm's fixed location, so fetch them once
// and reuse for every question instead of re-fetching on each message.
let agrointelIndicatorsPromise = null;

function getAgrointelIndicators() {
  if (!agrointelIndicatorsPromise) {
    agrointelIndicatorsPromise = fetch(`${AGROINTEL_API_BASE}/indicators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // SMAP soil-moisture lookups can take 60s+ for some locations and
      // time out client-side, so this skips it and relies on POWER-only
      // indicators (temp/rainfall anomalies, dry spells) which respond in ~1s.
      body: JSON.stringify({ lat: FARM_LAT, lon: FARM_LON, include_soil_moisture: false })
    }).then(res => {
      if (!res.ok) throw new Error(`indicators HTTP ${res.status}`);
      return res.json();
    }).catch(err => {
      agrointelIndicatorsPromise = null; // allow retry on next question
      throw err;
    });
  }
  return agrointelIndicatorsPromise;
}

// Turns the AI's plain-text answer (markdown-ish: **bold**, "- " bullets,
// blank-line paragraphs) into clean, readable HTML instead of dumping raw
// asterisks on screen.
function formatAiAnswer(text) {
  const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>');

  // Walk line by line (not blank-line blocks) so a bullet list that starts
  // right under a heading line, with no blank line between them, still
  // becomes a real <ul>/<ol> instead of a paragraph with literal "* " in it.
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const html = [];
  let listItems = null; // { tag: 'ul'|'ol', items: [...] }

  const flushList = () => {
    if (listItems) {
      html.push(`<${listItems.tag}>${listItems.items.map(i => `<li>${inline(i)}</li>`).join('')}</${listItems.tag}>`);
      listItems = null;
    }
  };

  lines.forEach(line => {
    const bulletMatch = line.match(/^[-*•]\s+(.*)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)/);

    if (bulletMatch) {
      if (!listItems || listItems.tag !== 'ul') { flushList(); listItems = { tag: 'ul', items: [] }; }
      listItems.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (!listItems || listItems.tag !== 'ol') { flushList(); listItems = { tag: 'ol', items: [] }; }
      listItems.items.push(numberedMatch[1]);
    } else {
      flushList();
      html.push(`<p>${inline(line)}</p>`);
    }
  });
  flushList();

  return html.join('');
}

async function askAgrointelAi(question) {
  const thinking = document.createElement('div');
  thinking.className = 'chat-msg bot';
  thinking.textContent = 'Thinking…';
  chatMessages.appendChild(thinking);
  thinking.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const indicators = await getAgrointelIndicators();
    const chatRes = await fetch(`${AGROINTEL_API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        location_label: AGROINTEL_LOCATION_LABEL,
        indicators
      })
    });
    if (!chatRes.ok) throw new Error(`chat HTTP ${chatRes.status}`);
    const chat = await chatRes.json();

    thinking.remove();
    addChatMsg(formatAiAnswer(chat.answer || 'No answer returned.'), 'bot');
  } catch (err) {
    console.error(err);
    thinking.remove();
    addChatMsg('Sorry, something went wrong talking to AGROINTEL AI. Please try again in a moment.', 'bot');
  }
}

function sendChat() {
  const val = chatInput?.value?.trim();
  if (!val) return;
  addChatMsg(val, 'user');
  chatInput.value = '';
  handleChatCommand(val);
}

document.getElementById('chat-send')?.addEventListener('click', sendChat);
chatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

// ===== Suitability Index grid (real, per-searched-location) =====
// Replaces the old hardcoded illustrative zones. Whenever the map's
// location changes (initial farm load, or a successful place search),
// this samples a small grid of real points inside that area via our own
// AGROINTEL AI API, derives 3 real "models" from the fetched indicators,
// and paints the grid as colored cells — switchable instantly client-side
// since all models reuse the same fetched data. Never precomputed for
// anywhere the user hasn't actually looked at.

const SI_LEGEND_CLASSES = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];

// Risk models (erosion, water) use red=high risk; the suitability model
// uses the same 5-step ramp but green=high suitability, since a "high
// suitability" reading is good news, not a warning.
const SI_RISK_COLORS = ['#2e7d32', '#8bc34a', '#f1c40f', '#e67e22', '#c0392b'];
const SI_SUITABILITY_COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#8bc34a', '#2e7d32'];

let siGridLayer = L.layerGroup().addTo(map);
let siBoundaryLayer = L.layerGroup().addTo(map);
let siGridCache = null; // { key, cells: [{lat, lon, south, north, west, east, erosion, water, suitability}] }
const siLocationCache = new Map(); // boundingBoxKey -> cells

function siBoundingBoxFor() {
  // Sample the map's actual current viewport, not just a box around the
  // searched point, so the heatmap covers the whole visible map rather
  // than leaving most of it blank. invalidateSize() first because Leaflet
  // can still be using a stale (too-small) container size this early in
  // page load, which otherwise under-reports getBounds() and leaves the
  // heatmap short of the real edges once layout settles.
  map.invalidateSize();
  const b = map.getBounds();
  return { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() };
}

function siBuildGrid(box, maxPoints = 25) {
  const cols = Math.max(2, Math.min(6, Math.round(Math.sqrt(maxPoints))));
  const rows = cols;
  const latStep = (box.north - box.south) / rows;
  const lonStep = (box.east - box.west) / cols;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const south = box.south + r * latStep;
      const north = south + latStep;
      const west = box.west + c * lonStep;
      const east = west + lonStep;
      cells.push({ lat: (south + north) / 2, lon: (west + east) / 2, south, north, west, east });
    }
  }
  return cells;
}

// Ray-casting point-in-ring test (GeoJSON ring: array of [lon, lat]).
function siPointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = (yi > lat) !== (yj > lat) &&
      lon < (xj - xi) * (lat - yi) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// A GeoJSON Polygon's first ring is its outer boundary; any further rings
// are holes, so XOR-ing all ring results gives "inside the shape, outside
// any hole" without needing to know winding direction.
function siPointInPolygonRings(lat, lon, rings) {
  let inside = false;
  for (const ring of rings) {
    if (siPointInRing(lat, lon, ring)) inside = !inside;
  }
  return inside;
}

// Supports both Polygon and MultiPolygon (e.g. Malaysia's separated
// Peninsular + Borneo territory) — true if inside any part.
function siPointInGeometry(lat, lon, geometry) {
  if (!geometry) return true; // no real shape known (bare point) - keep everything
  if (geometry.type === 'Polygon') {
    return siPointInPolygonRings(lat, lon, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(polygonRings => siPointInPolygonRings(lat, lon, polygonRings));
  }
  return true;
}

function siRingBBox(ring) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  ring.forEach(([lon, lat]) => {
    west = Math.min(west, lon); east = Math.max(east, lon);
    south = Math.min(south, lat); north = Math.max(north, lat);
  });
  return { west, east, south, north };
}

function siRingArea(bbox) {
  return (bbox.east - bbox.west) * (bbox.north - bbox.south);
}

// A country's real shape can be split into separate landmasses (e.g.
// Malaysia: Peninsular + Borneo). Gridding one box over the whole combined
// extent wastes almost every sample point on the ocean between them, so
// instead this grids each part's own bounding box separately and only
// keeps points that land inside that specific part.
function siBuildGridForGeometry(geometry, box, pointsPerPart = 25) {
  if (!geometry) return siBuildGrid(box, pointsPerPart);

  const parts = geometry.type === 'MultiPolygon' ? geometry.coordinates
    : geometry.type === 'Polygon' ? [geometry.coordinates]
    : null;
  if (!parts) return siBuildGrid(box, pointsPerPart);

  // Cap how many separate parts get their own grid, largest first, so a
  // country simplified down to many small islands doesn't balloon API
  // calls - the biggest landmasses matter most for a usable map.
  const ranked = parts
    .map(rings => ({ rings, bbox: siRingBBox(rings[0]) }))
    .sort((a, b) => siRingArea(b.bbox) - siRingArea(a.bbox))
    .slice(0, 4);

  const cells = [];
  ranked.forEach(({ rings, bbox }) => {
    const partCells = siBuildGrid(bbox, pointsPerPart)
      .filter(cell => siPointInPolygonRings(cell.lat, cell.lon, rings));
    cells.push(...partCells);
  });
  return cells;
}

async function siFetchCell(cell) {
  try {
    const indicatorsRes = await fetch(`${AGROINTEL_API_BASE}/indicators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: cell.lat, lon: cell.lon, include_soil_moisture: false })
    });
    if (!indicatorsRes.ok) throw new Error(`indicators HTTP ${indicatorsRes.status}`);
    const indicators = await indicatorsRes.json();

    const scoreRes = await fetch(`${AGROINTEL_API_BASE}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indicators })
    });
    let topScore = null;
    let topResilience = null;
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      const comparisons = scoreData.comparisons || [];
      const scores = comparisons.map(c => c.overall_score).filter(v => typeof v === 'number');
      if (scores.length) topScore = Math.max(...scores);
      // climate_resilience is one of the two real (non-assumption) scoring
      // criteria in src/scoring/model.py — the other real one, erosion
      // reduction, is already represented by the Erosion Risk model above.
      const resilienceScores = comparisons
        .map(c => c.criteria_scores?.climate_resilience)
        .filter(v => typeof v === 'number');
      if (resilienceScores.length) topResilience = Math.max(...resilienceScores);
    }

    return {
      ...cell,
      tempAnomaly: indicators.temp_anomaly_mean_c,
      extremeRainDays: indicators.extreme_rainfall_days,
      drySpellDays: indicators.longest_dry_spell_days,
      suitabilityScore: topScore,
      climateResilience: topResilience
    };
  } catch (err) {
    console.error('SI cell fetch failed', cell.lat, cell.lon, err);
    return { ...cell, failed: true };
  }
}

function siClassify(values, value) {
  // Quantile thresholds over this grid's own real values, so "High"/"Low"
  // is always relative to the area actually being looked at.
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const thresholds = [q(0.2), q(0.4), q(0.6), q(0.8)];
  let idx = thresholds.findIndex(t => value <= t);
  return idx === -1 ? 4 : idx;
}

// Models where a HIGH value is good news (suitability/resilience) get the
// green-high ramp; everything else is a risk reading (red-high ramp).
const SI_GOOD_WHEN_HIGH = new Set(['suitability', 'resilience']);

function siModelValue(cell, model) {
  if (model === 'erosion') return cell.extremeRainDays ?? 0;
  if (model === 'water') return (cell.drySpellDays ?? 0) + Math.max(0, cell.tempAnomaly ?? 0) * 2;
  if (model === 'temp') return cell.tempAnomaly ?? 0;
  if (model === 'resilience') return cell.climateResilience ?? 0;
  return cell.suitabilityScore ?? 0; // 'suitability'
}

function siModelTitle(model) {
  return {
    erosion: 'Erosion Risk (real)',
    water: 'Water Stress (real)',
    temp: 'Temperature Anomaly (real)',
    resilience: 'Climate Resilience (real)',
    suitability: 'Overall Suitability (real)'
  }[model];
}

// Honest provenance note per map model: which part of the AI's backend
// scoring is a real NASA measurement vs. a documented expert-baseline
// assumption, so the badge in the sidebar never overstates confidence.
function siModelProvenance(model) {
  return {
    erosion: 'NASA data: real GPM extreme-rainfall-day counts drive this directly.',
    water: 'NASA data: real NASA POWER dry-spell length + temperature anomaly drive this directly.',
    temp: 'NASA data: real NASA POWER temperature anomaly vs. 5-year climatology.',
    resilience: 'NASA data: real NASA POWER dry-spell + temperature anomaly, scaled by a documented per-strategy sensitivity assumption.',
    suitability: 'Mixed: real NASA data drives climate resilience, erosion reduction, and water-use trend; soil health, pest cycles, and market value remain documented expert baselines. Ask the chat for a full per-criterion breakdown of any area.'
  }[model];
}

function siRenderLegend(model) {
  const legend = document.getElementById('si-legend');
  if (!legend) return;
  const colors = SI_GOOD_WHEN_HIGH.has(model) ? SI_SUITABILITY_COLORS : SI_RISK_COLORS;
  legend.innerHTML = `<div class="si-legend-title">${siModelTitle(model)}</div>` +
    `<div class="si-legend-provenance">${siModelProvenance(model)}</div>` +
    SI_LEGEND_CLASSES.map((label, i) => `
      <div class="si-legend-row"><span class="si-legend-swatch" style="background:${colors[i]}"></span>${label}</div>
    `).join('');
}

// Parses a "#rrggbb" color into {r,g,b} for gradient-stop interpolation.
function siHexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function siHeatGradient(model) {
  const colors = SI_GOOD_WHEN_HIGH.has(model) ? SI_SUITABILITY_COLORS : SI_RISK_COLORS;
  const stops = {};
  colors.forEach((hex, i) => {
    const { r, g, b } = siHexToRgb(hex);
    stops[(i / (colors.length - 1)).toFixed(2)] = `rgb(${r},${g},${b})`;
  });
  return stops;
}

// Picks a heat radius/blur (in screen pixels) from the on-screen spacing
// between adjacent grid points, so sampled points blend into continuous
// coverage instead of leaving visible gaps — recalculated on zoom change.
function siHeatSizingFor(cells) {
  if (cells.length < 2) return { radius: 40, blur: 30 };
  const p0 = map.latLngToContainerPoint([cells[0].lat, cells[0].lon]);
  const p1 = map.latLngToContainerPoint([cells[1].lat, cells[1].lon]);
  const spacing = Math.max(20, Math.hypot(p1.x - p0.x, p1.y - p0.y));
  // Generous overlap between adjacent points' kernels for smooth, seamless
  // blending (no visible blob/gap edges) across the whole viewport.
  return { radius: spacing * 1.15, blur: spacing * 0.95 };
}

function siRenderGrid(cells, model) {
  siGridLayer.clearLayers();
  const valid = cells.filter(c => !c.failed);
  if (!valid.length) return;
  const values = valid.map(c => siModelValue(c, model));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const { radius, blur } = siHeatSizingFor(valid);
  const heatPoints = valid.map(cell => {
    const value = siModelValue(cell, model);
    // Normalized 0..1 intensity for a smooth gradient between real sampled
    // values (interpolated by the heat renderer) — the discrete 5-class
    // legend below is derived from the same values via quantiles, kept in
    // sync so what's labeled matches what's painted.
    const intensity = 0.15 + 0.85 * ((value - min) / span);
    return [cell.lat, cell.lon, intensity];
  });

  const heat = L.heatLayer(heatPoints, {
    radius, blur, max: 1, minOpacity: 0.45,
    gradient: siHeatGradient(model)
  });
  heat.addTo(siGridLayer);

  // Invisible click targets at each sample point so the real numbers
  // behind the smoothed color are still inspectable.
  valid.forEach(cell => {
    const value = siModelValue(cell, model);
    const classIdx = siClassify(values, value);
    const label = SI_LEGEND_CLASSES[classIdx];
    const marker = L.circleMarker([cell.lat, cell.lon], { radius: 10, opacity: 0, fillOpacity: 0 });
    marker.bindPopup(`
      <strong>${label}</strong><br>
      Temp anomaly: ${cell.tempAnomaly?.toFixed(2) ?? '—'}°C<br>
      Extreme rainfall days: ${cell.extremeRainDays ?? '—'}<br>
      Longest dry spell: ${cell.drySpellDays ?? '—'} days<br>
      Climate resilience: ${cell.climateResilience != null ? cell.climateResilience.toFixed(1) + '/100' : '—'}<br>
      Best-strategy score: ${cell.suitabilityScore != null ? cell.suitabilityScore.toFixed(1) + '/100' : '—'}
    `);
    marker.addTo(siGridLayer);
  });

  siRenderLegend(model);

  // Heat layer sizing depends on screen pixel spacing, which changes with
  // zoom — re-render (cheap, no refetch) so it keeps blending smoothly.
  map.off('zoomend', siRerenderCurrentModel);
  map.on('zoomend', siRerenderCurrentModel);
}

function siRerenderCurrentModel() {
  if (!siGridCache) return;
  const model = document.getElementById('si-model-select')?.value || 'erosion';
  siRenderGrid(siGridCache.cells, model);
}

let siLastLocation = null;

async function updateSuitabilityForLocation(loc) {
  siLastLocation = loc;
  const status = document.getElementById('si-status');
  const toggle = document.getElementById('si-toggle');

  if (toggle && !toggle.checked) {
    siGridLayer.clearLayers();
    if (status) status.textContent = 'Suitability heatmap is off.';
    return;
  }

  const box = siBoundingBoxFor();
  const cacheKey = [box.south, box.north, box.west, box.east].map(v => v.toFixed(2)).join(',');

  if (siLocationCache.has(cacheKey)) {
    siGridCache = { key: cacheKey, cells: siLocationCache.get(cacheKey) };
    const model = document.getElementById('si-model-select')?.value || 'erosion';
    siRenderGrid(siGridCache.cells, model);
    if (status) status.textContent = `Showing real data for ${loc.name || 'this area'} (cached).`;
    return;
  }

  if (status) status.textContent = `Computing real data for ${loc.name || 'this area'}…`;
  // With a real shape, grid each landmass part separately (not one grid
  // over the whole combined bbox, which would waste most points on ocean
  // between e.g. Malaysia's Peninsular and Borneo territory).
  const grid = siBuildGridForGeometry(loc.geometry, box, 25);
  const results = await Promise.all(grid.map(siFetchCell));
  siLocationCache.set(cacheKey, results);
  siGridCache = { key: cacheKey, cells: results };

  const failedCount = results.filter(c => c.failed).length;
  if (status) {
    status.textContent = failedCount
      ? `Real data for ${loc.name || 'this area'} (${failedCount} of ${results.length} points unavailable).`
      : `Real data for ${loc.name || 'this area'} — ${results.length} points.`;
  }

  const model = document.getElementById('si-model-select')?.value || 'erosion';
  siRenderGrid(results, model);
}

document.getElementById('si-model-select')?.addEventListener('change', (e) => {
  if (siGridCache) siRenderGrid(siGridCache.cells, e.target.value);
});

document.getElementById('si-toggle')?.addEventListener('change', (e) => {
  const status = document.getElementById('si-status');
  if (!e.target.checked) {
    siGridLayer.clearLayers();
    if (status) status.textContent = 'Suitability heatmap is off.';
    return;
  }
  // Re-enabling: re-render from cache if we already have data for the
  // current view, otherwise fetch fresh for the last searched location.
  const box = siBoundingBoxFor();
  const cacheKey = [box.south, box.north, box.west, box.east].map(v => v.toFixed(2)).join(',');
  if (siLocationCache.has(cacheKey)) {
    siGridCache = { key: cacheKey, cells: siLocationCache.get(cacheKey) };
    siRenderGrid(siGridCache.cells, document.getElementById('si-model-select')?.value || 'erosion');
  } else if (siLastLocation) {
    updateSuitabilityForLocation(siLastLocation);
  }
});

// Initial grid for the default sample farm.
updateSuitabilityForLocation({ lat: FARM_LAT, lon: FARM_LON, name: AGROINTEL_LOCATION_LABEL, boundingBox: null });
