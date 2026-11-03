// Live-location tracker for the SOS feature.
//
//   POST   /api/sessions               app starts sharing  -> { id, token, url, expiresAt }
//   PUT    /api/sessions/:id/location  app pushes a point  (Bearer token)
//   DELETE /api/sessions/:id           app stops sharing   (Bearer token)
//   GET    /api/sessions/:id           viewer polls this   (public, link = access)
//   GET    /t/:id                      the page contacts open from the SMS
//
// No dependencies. Needs Node 18+. Run:  node server.mjs
// Env: PORT (default 8080), PUBLIC_URL (e.g. https://track.example.com),
//      DATA_FILE (default ./sessions.json)

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const PORT = Number(process.env.PORT ?? 8080);
const DATA_FILE = process.env.DATA_FILE ?? new URL("./sessions.json", import.meta.url).pathname;
const MAX_DURATION_MIN = 12 * 60;
const KEEP_AFTER_END_MS = 60 * 60 * 1000; // viewer can still see "ended" for an hour
const TRAIL_POINTS = 60;
const MAX_BODY = 4 * 1024;

/** @type {Map<string, any>} */
const sessions = new Map();

// ---------- persistence (so a restart doesn't kill live sessions) ----------
try {
  for (const s of JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))) sessions.set(s.id, s);
} catch {
  /* first run */
}
let saveTimer = null;
function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.writeFile(DATA_FILE, JSON.stringify([...sessions.values()]), () => {});
  }, 1000);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now > Math.max(s.expiresAt, s.endedAt ?? 0) + KEEP_AFTER_END_MS) sessions.delete(id);
  }
  saveSoon();
}, 60_000).unref();

// ---------- tiny rate limit: sessions created per IP per hour ----------
const created = new Map();
function allowCreate(ip) {
  const now = Date.now();
  const recent = (created.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 20) return false;
  recent.push(now);
  created.set(ip, recent);
  return true;
}

// ---------- helpers ----------
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

const validCoord = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function authorised(req, session) {
  const header = req.headers.authorization ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const real = Buffer.from(session.token);
  return given.length === real.length && crypto.timingSafeEqual(given, real);
}

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  return `${proto}://${req.headers.host}`;
}

const isLive = (s) => !s.endedAt && Date.now() < s.expiresAt;

function publicView(s) {
  return {
    name: s.name,
    live: isLive(s),
    ended: Boolean(s.endedAt),
    expiresAt: s.expiresAt,
    startedAt: s.startedAt,
    last: s.trail.at(-1) ?? null, // { lat, lng, accuracy, ts }
    trail: s.trail,
  };
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const path = url.pathname;
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

  try {
    if (req.method === "GET" && path === "/health") return json(res, 200, { ok: true });

    if (req.method === "POST" && path === "/api/sessions") {
      if (!allowCreate(ip)) return json(res, 429, { error: "Too many sessions" });
      const b = await readBody(req);
      const durationMin = Math.min(Math.max(Number(b.durationMin) || 60, 1), MAX_DURATION_MIN);
      if (!validCoord(b.lat, b.lng)) return json(res, 400, { error: "lat/lng required" });

      const now = Date.now();
      const id = crypto.randomBytes(12).toString("base64url"); // in the public link
      const token = crypto.randomBytes(24).toString("base64url"); // only the phone has this
      const session = {
        id,
        token,
        name: typeof b.name === "string" ? b.name.slice(0, 40) : "",
        startedAt: now,
        expiresAt: now + durationMin * 60_000,
        endedAt: null,
        lastClientTs: 0, // phone clock, used only to drop out-of-order updates
        trail: [{ lat: b.lat, lng: b.lng, accuracy: Number(b.accuracy) || null, ts: now }],
      };
      sessions.set(id, session);
      saveSoon();
      return json(res, 201, {
        id,
        token,
        expiresAt: session.expiresAt,
        url: `${baseUrl(req)}/t/${id}`,
      });
    }

    const m = path.match(/^\/api\/sessions\/([\w-]+)(\/location)?$/);
    if (m) {
      const session = sessions.get(m[1]);
      if (!session) return json(res, 404, { error: "Not found" });

      if (req.method === "GET" && !m[2]) return json(res, 200, publicView(session));

      if (req.method === "PUT" && m[2]) {
        if (!authorised(req, session)) return json(res, 401, { error: "Unauthorised" });
        if (!isLive(session)) return json(res, 410, { error: "Session over" });
        const b = await readBody(req);
        if (!validCoord(b.lat, b.lng)) return json(res, 400, { error: "lat/lng required" });
        // The phone's clock may be off, so it only decides ordering. What the
        // viewer sees ("updated 5 s ago") uses the server's clock.
        const clientTs = Number(b.ts) > 0 ? Number(b.ts) : Date.now();
        if (clientTs <= session.lastClientTs) return json(res, 200, { ok: true, ignored: "older" });
        session.lastClientTs = clientTs;
        session.trail.push({
          lat: b.lat,
          lng: b.lng,
          accuracy: Number(b.accuracy) || null,
          ts: Date.now(),
        });
        if (session.trail.length > TRAIL_POINTS) session.trail.shift();
        saveSoon();
        return json(res, 200, { ok: true, expiresAt: session.expiresAt });
      }

      if (req.method === "DELETE" && !m[2]) {
        if (!authorised(req, session)) return json(res, 401, { error: "Unauthorised" });
        session.endedAt ??= Date.now();
        saveSoon();
        return json(res, 200, { ok: true });
      }
    }

    if (req.method === "GET" && /^\/t\/[\w-]+$/.test(path)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      });
      return res.end(VIEWER_HTML);
    }

    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, e.message === "too large" ? 413 : 400, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Tracker listening on :${PORT}`));

// ---------- the page contacts see ----------
const VIEWER_HTML = /* html */ `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Live location</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  :root{--bg:#FBF1EA;--card:#fff;--ink:#3B1F16;--muted:#8E6C5F;--primary:#B5532F;--coral:#E5584F;--ok:#2E7D4F}
  *{box-sizing:border-box} html,body{height:100%;margin:0}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink);display:flex;flex-direction:column}
  header{padding:14px 18px;background:var(--card);box-shadow:0 2px 12px rgba(122,46,23,.12);z-index:2}
  .row{display:flex;align-items:center;gap:10px}
  .dot{width:12px;height:12px;border-radius:50%;background:var(--muted)}
  .dot.live{background:var(--coral);animation:p 1.4s infinite}
  @keyframes p{50%{opacity:.35}}
  h1{font-size:18px;margin:0}
  #sub{color:var(--muted);font-size:14px;margin-top:4px}
  #map{flex:1;min-height:200px}
  footer{padding:12px 18px;background:var(--card);display:flex;gap:10px;align-items:center;justify-content:space-between}
  a.btn{background:var(--primary);color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:999px;font-size:15px}
  #coords{color:var(--muted);font-size:13px}
  #msg{padding:28px;text-align:center;display:none}
</style></head><body>
<header>
  <div class="row"><span id="dot" class="dot"></span><h1 id="title">Loading…</h1></div>
  <div id="sub"></div>
</header>
<div id="msg"></div>
<div id="map"></div>
<footer><span id="coords"></span><a id="gmaps" class="btn" href="#" target="_blank" rel="noopener">Open in Maps</a></footer>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var id = location.pathname.split("/").pop();
  var $ = function(i){return document.getElementById(i)};
  var map, marker, ring, line, first = true;

  function ago(ms){
    var s = Math.max(0, Math.round(ms/1000));
    if (s < 10) return "just now";
    if (s < 60) return s + " seconds ago";
    var m = Math.round(s/60);
    if (m < 60) return m + " min ago";
    return Math.floor(m/60) + " h " + (m%60) + " min ago";
  }
  function left(ms){
    var m = Math.max(0, Math.ceil(ms/60000));
    return m >= 60 ? Math.floor(m/60) + " h " + (m%60) + " min" : m + " min";
  }

  function render(d){
    var who = d.name ? d.name : "Your contact";
    if (!d.last){ $("title").textContent = "Waiting for location…"; return; }
    var last = d.last, now = Date.now();
    $("dot").className = "dot" + (d.live ? " live" : "");
    $("title").textContent = d.live ? who + " is sharing live location" : (d.ended ? "Sharing stopped" : "Sharing has ended");
    $("sub").textContent = "Updated " + ago(now - last.ts) + (d.live ? " · ends in " + left(d.expiresAt - now) : " · showing last known position");
    $("coords").textContent = last.lat.toFixed(5) + ", " + last.lng.toFixed(5) + (last.accuracy ? " (±" + Math.round(last.accuracy) + " m)" : "");
    $("gmaps").href = "https://www.google.com/maps/search/?api=1&query=" + last.lat + "," + last.lng;

    if (!window.L) return; // map library blocked: coordinates + button still work
    var ll = [last.lat, last.lng];
    if (!map){
      map = L.map("map",{zoomControl:true}).setView(ll, 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
      line = L.polyline([], {color:"#B5532F",weight:4,opacity:.6}).addTo(map);
      marker = L.circleMarker(ll,{radius:9,color:"#fff",weight:3,fillColor:"#E5584F",fillOpacity:1}).addTo(map);
      ring = L.circle(ll,{radius:last.accuracy||0,color:"#E5584F",weight:1,fillOpacity:.1}).addTo(map);
    }
    marker.setLatLng(ll); ring.setLatLng(ll); ring.setRadius(last.accuracy||0);
    line.setLatLngs(d.trail.map(function(p){return [p.lat,p.lng]}));
    if (first){ first = false; } else if (!map.getBounds().contains(ll)) map.panTo(ll);
  }

  function showGone(text){
    $("map").style.display="none"; $("msg").style.display="block"; $("msg").textContent = text;
    $("title").textContent = "Link not available"; $("dot").className="dot";
  }

  function tick(){
    fetch("/api/sessions/" + id, {cache:"no-store"}).then(function(r){
      if (r.status === 404) { showGone("This link has expired or doesn't exist."); return null; }
      return r.json();
    }).then(function(d){ if (d) render(d); }).catch(function(){ $("sub").textContent = "Connection problem — retrying…"; });
  }
  tick(); setInterval(tick, 5000);
})();
</script></body></html>`;
