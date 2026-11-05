/* ── Tourist Safety App — Frontend JS ────────────────────────────────────── */
'use strict';

const API = '';   // same origin; change to 'http://localhost:8000' if needed

// ── Utility ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const labelClass = lbl => lbl === 'Safe' ? 'safe' : lbl === 'Caution' ? 'caution' : 'avoid';

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (e) {
    console.error('API error:', e);
    return null;
  }
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const diffH = (Date.now() - d.getTime()) / 3600000;
  if (diffH < 1) return `${Math.round(diffH * 60)}min ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

// ── Map ───────────────────────────────────────────────────────────────────────
const map = L.map('map').setView([9.9312, 76.2673], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

const markers = {};           // place_id -> marker
const incidentMarkers = [];   // incident markers

function scoreColor(score) {
  if (score >= 70) return '#22c55e';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

function makeCircleIcon(score, label) {
  const color = scoreColor(score);
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${color}22;border:2.5px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:11px;color:${color};
      box-shadow:0 2px 6px rgba(0,0,0,.4)
    ">${score}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// Load and render all places on the map
async function loadPlacesOnMap() {
  const places = await apiFetch('/places?limit=200');
  if (!places) return;

  for (const p of places) {
    const marker = L.marker([p.lat, p.lon], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          width:10px;height:10px;border-radius:50%;
          background:#38bdf8;border:2px solid #0f172a;
          box-shadow:0 1px 4px rgba(0,0,0,.5)
        "></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5],
      }),
    }).addTo(map);

    marker.bindPopup(`<b>${p.name}</b><br><small>${p.category}</small>`);
    marker.on('click', () => showPlaceDetail(p));
    markers[p.id] = { marker, place: p };
  }
}

async function refreshMarkerScores(places) {
  for (const p of places) {
    const m = markers[p.id];
    if (!m || !p.score) continue;
    m.marker.setIcon(makeCircleIcon(p.score, p.label));
    m.marker.setPopupContent(
      `<b>${p.name}</b><br>
       <span style="color:${scoreColor(p.score)};font-weight:700">${p.label} — ${p.score}/100</span>`
    );
  }
}

// ── Place Detail Overlay ──────────────────────────────────────────────────────
async function showPlaceDetail(place) {
  $('detail-name').textContent = place.name;

  // Fetch live score
  const res = await apiFetch(`/safety-score?lat=${place.lat}&lon=${place.lon}`);
  if (res) {
    const ring = $('detail-ring');
    ring.textContent = res.score;
    ring.className = `score-ring lg ${labelClass(res.label)}`;
    $('detail-label').textContent = res.label;
    $('detail-label').className = `score-label ${labelClass(res.label)}`;

    const ul = $('detail-reasons');
    ul.innerHTML = res.explanation.map(r => `<li>${r}</li>`).join('');
    $('detail-disclaimer').textContent = res.disclaimer;
  }

  // Best hours
  const scoreRes = await apiFetch(`/safety-score?lat=${place.lat}&lon=${place.lon}`);

  // Fetch incidents
  const incs = await apiFetch(`/incidents?lat=${place.lat}&lon=${place.lon}&radius_km=2&hours=48`);
  const incDiv = $('detail-incidents');
  if (incs && incs.length > 0) {
    incDiv.innerHTML = incs.slice(0, 5).map(i => `
      <div class="inc-card sev-${i.severity}">
        <div class="inc-type">${i.incident_type} · sev ${i.severity}/5
          <span class="${i.verified ? 'badge-verified' : 'badge-unverified'}">
            ${i.verified ? 'Verified' : 'Unverified'}
          </span>
        </div>
        <div class="inc-headline">${i.headline}</div>
        <div class="inc-meta">
          <span>${timeAgo(i.timestamp)}</span>
          ${i.source_url ? `<a class="inc-link" href="${i.source_url}" target="_blank" rel="noopener">Source ↗</a>` : ''}
        </div>
      </div>
    `).join('');
  } else {
    incDiv.innerHTML = '<p class="hint">No incidents reported nearby in the last 48 h.</p>';
  }

  // Best hours (generate from 24-hour sweep — simplified client side)
  const hoursDiv = $('detail-hours');
  hoursDiv.innerHTML = '<span class="hint">Loading…</span>';
  try {
    // We'll use the /trip endpoint to get best hours — or compute client-side
    const now = new Date();
    const hourScores = [];
    // Quick client-side estimate (we only have the current score)
    // For a real "best hours" we'd call a dedicated endpoint.
    // We'll request the trip data which includes best_hours_today
    const tripData = await apiFetch('/trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Kochi', lat: place.lat, lon: place.lon }),
    });
    const dest = tripData && tripData.destinations
      ? tripData.destinations.find(d => d.id === place.id)
      : null;
    if (dest && dest.best_hours_today && dest.best_hours_today.length > 0) {
      hoursDiv.innerHTML = dest.best_hours_today.slice(0, 5).map(h =>
        `<div class="hour-badge ${labelClass(h.label)}">
          <span>${h.hour}:00</span>
          <span style="font-size:.65rem">${h.score}</span>
        </div>`
      ).join('');
    } else {
      hoursDiv.innerHTML = '<p class="hint">Best hours data unavailable.</p>';
    }
  } catch (e) {
    hoursDiv.innerHTML = '<p class="hint">Best hours data unavailable.</p>';
  }

  $('place-detail').classList.remove('hidden');
}

$('detail-close').onclick = () => $('place-detail').classList.add('hidden');

// ── Tab Navigation ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $(`tab-${tab}`).classList.add('active');
    if (tab === 'incidents') loadIncidents();
  });
});

// ── Destination Helpers ───────────────────────────────────────────────────────
window.setPlace = name => {
  $('sc-place').value = name;
  if ($('sc-lat')) $('sc-lat').value = '';
  if ($('sc-lon')) $('sc-lon').value = '';
  $('sc-btn').click();
};

const coordsToggle = $('toggle-coords-link');
if (coordsToggle) {
  coordsToggle.onclick = () => {
    $('coords-inputs').classList.toggle('hidden');
  };
}

// ── Safety Check Tab ──────────────────────────────────────────────────────────
$('sc-btn').onclick = async () => {
  const place = ($('sc-place').value || '').trim();
  const latVal = $('sc-lat') ? parseFloat($('sc-lat').value) : NaN;
  const lonVal = $('sc-lon') ? parseFloat($('sc-lon').value) : NaN;

  let queryUrl = '';
  if (!isNaN(latVal) && !isNaN(lonVal)) {
    queryUrl = `/safety-score?lat=${latVal}&lon=${lonVal}`;
  } else if (place) {
    queryUrl = `/safety-score?place=${encodeURIComponent(place)}`;
  } else {
    alert('Please enter a destination name (e.g. Fort Kochi, Marine Drive) or coordinates');
    return;
  }

  $('sc-btn').disabled = true;
  $('sc-btn').textContent = 'Checking…';
  $('sc-result').classList.add('hidden');

  const res = await apiFetch(queryUrl);
  $('sc-btn').disabled = false;
  $('sc-btn').textContent = 'Check Safety';

  if (!res) { alert('Could not reach API. Is the server running?'); return; }

  // Update place display
  const placeDisp = $('sc-place-display');
  if (placeDisp) {
    placeDisp.textContent = res.place_name ? `📍 ${res.place_name}` : (place ? `📍 ${place}` : '');
  }

  const ring = $('sc-score-ring');
  ring.textContent = res.score;
  ring.className = `score-ring ${labelClass(res.label)}`;
  $('sc-label').textContent = `${res.label} — ${res.score}/100`;
  $('sc-label').className = `score-label ${labelClass(res.label)}`;
  $('sc-reasons').innerHTML = res.explanation.map(r => `<li>${r}</li>`).join('');
  $('sc-weather').textContent = res.weather_warnings.join(' · ');
  $('sc-freshness').textContent = `Data as of: ${new Date(res.data_freshness).toLocaleString()}`;
  $('sc-confidence').textContent = `Confidence: ${res.confidence}`;
  $('sc-result').classList.remove('hidden');

  // Pan map and drop a marker popup
  if (res.lat && res.lon) {
    map.panTo([res.lat, res.lon]);
    L.popup()
      .setLatLng([res.lat, res.lon])
      .setContent(`<b>${res.place_name || place || 'Destination'}</b><br><span style="color:${scoreColor(res.score)};font-weight:700">${res.label} — ${res.score}/100</span>`)
      .openOn(map);
  }
};

// Click on map to fill coords and auto-switch
map.on('click', e => {
  if ($('sc-lat') && $('sc-lon')) {
    $('sc-lat').value = e.latlng.lat.toFixed(5);
    $('sc-lon').value = e.latlng.lng.toFixed(5);
    $('coords-inputs').classList.remove('hidden');
    $('sc-place').value = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
  }
});

// ── Trip Planner Tab ──────────────────────────────────────────────────────────
$('tp-my-loc').onclick = () => {
  if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    $('tp-lat').value = pos.coords.latitude.toFixed(5);
    $('tp-lon').value = pos.coords.longitude.toFixed(5);
    $('tp-loc-name').value = 'Current GPS Location';
  }, () => alert('Location permission denied'));
};

$('tp-btn').onclick = async () => {
  const interests = [...document.querySelectorAll('#interest-chips input:checked')].map(c => c.value);
  const sortBy = $('tp-sort').value;
  const locName = ($('tp-loc-name').value || '').trim();
  const lat = parseFloat($('tp-lat').value) || null;
  const lon = parseFloat($('tp-lon').value) || null;

  $('tp-btn').disabled = true;
  $('tp-btn').textContent = 'Planning…';
  $('tp-results').innerHTML = '<p class="loader">Scoring destinations… please wait.</p>';

  const body = { city: 'Kochi', interests, sort_by: sortBy };
  if (locName) body.location_name = locName;
  if (lat && lon) { body.lat = lat; body.lon = lon; }

  const res = await apiFetch('/trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  $('tp-btn').disabled = false;
  $('tp-btn').textContent = 'Explore Destinations';

  if (!res || !res.destinations) {
    $('tp-results').innerHTML = '<p class="hint">No results. Is the server running?</p>';
    return;
  }

  // Update map markers with scores
  await refreshMarkerScores(res.destinations);

  $('tp-results').innerHTML = res.destinations.map(d => `
    <div class="dest-card" onclick="showPlaceDetailById(${d.id}, ${d.lat}, ${d.lon})">
      <div class="mini-ring ${labelClass(d.label)}">${d.score}</div>
      <div class="dest-info">
        <div class="dest-name">${d.name}</div>
        <div class="dest-meta">
          <span class="dest-label ${labelClass(d.label)}">${d.label}</span>
          · ${d.category}
          ${d.distance_km != null ? ` · ${d.distance_km} km away` : ''}
        </div>
        <div class="dest-meta">${(d.top_reasons || []).slice(0, 2).join(' · ')}</div>
      </div>
    </div>
  `).join('');
};

window.showPlaceDetailById = async (id, lat, lon) => {
  const m = markers[id];
  if (m) {
    showPlaceDetail(m.place);
    map.panTo([lat, lon]);
  } else {
    showPlaceDetail({ id, lat, lon, name: `Place ${id}`, category: '' });
  }
};

// ── Incidents Tab ─────────────────────────────────────────────────────────────
async function loadIncidents() {
  const hours = parseInt($('inc-hours').value) || 48;
  $('inc-feed').innerHTML = '<p class="loader">Loading incidents…</p>';
  const data = await apiFetch(`/incidents?hours=${hours}&limit=50`);

  // Clear old incident markers
  incidentMarkers.forEach(m => m.remove());
  incidentMarkers.length = 0;

  if (!data || data.length === 0) {
    $('inc-feed').innerHTML = '<p class="hint">No incidents found for the selected time window.</p>';
    return;
  }

  data.forEach(inc => {
    if (inc.lat && inc.lon) {
      const color = inc.severity >= 4 ? '#ef4444' : inc.severity >= 3 ? '#f59e0b' : '#22c55e';
      const m = L.circleMarker([inc.lat, inc.lon], {
        radius: 6 + inc.severity,
        color,
        fillColor: color,
        fillOpacity: 0.5,
        weight: 2,
      }).addTo(map)
        .bindPopup(`<b>${inc.incident_type}</b><br>${inc.headline}<br><small>${timeAgo(inc.timestamp)}</small>`);
      incidentMarkers.push(m);
    }
  });

  $('inc-feed').innerHTML = data.map(i => `
    <div class="inc-card sev-${i.severity}">
      <div class="inc-type">${i.incident_type} · severity ${i.severity}/5
        <span class="${i.verified ? 'badge-verified' : 'badge-unverified'}">
          ${i.verified ? '✓ Verified' : 'Unverified'}
        </span>
      </div>
      <div class="inc-headline">${i.headline}</div>
      <div class="inc-meta">
        <span>${timeAgo(i.timestamp)}</span>
        <span>${i.location_name || ''}</span>
        <span>${i.source || ''}</span>
        ${i.source_url ? `<a class="inc-link" href="${i.source_url}" target="_blank" rel="noopener">Read more ↗</a>` : ''}
      </div>
    </div>
  `).join('');
}

$('inc-load-btn').onclick = loadIncidents;

// ── Report Incident ───────────────────────────────────────────────────────────
$('inc-report-btn').onclick = () => {
  $('report-form').classList.toggle('hidden');
  // Pre-fill coords from map centre
  const c = map.getCenter();
  $('rpt-lat').value = c.lat.toFixed(5);
  $('rpt-lon').value = c.lng.toFixed(5);
};

$('rpt-cancel').onclick = () => $('report-form').classList.add('hidden');

$('rpt-submit').onclick = async () => {
  const body = {
    incident_type: $('rpt-type').value,
    description:   $('rpt-desc').value.trim(),
    lat: parseFloat($('rpt-lat').value),
    lon: parseFloat($('rpt-lon').value),
  };
  if (!body.description) { alert('Please enter a description'); return; }
  if (isNaN(body.lat) || isNaN(body.lon)) { alert('Enter valid coordinates'); return; }

  const res = await apiFetch('/incidents/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res) {
    alert('✅ ' + res.message);
    $('report-form').classList.add('hidden');
    $('rpt-desc').value = '';
    loadIncidents();
  }
};

// ── Init ──────────────────────────────────────────────────────────────────────
loadPlacesOnMap();
