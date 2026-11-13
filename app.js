// Binnen Display, standalone: alles draait in de browser, geen eigen server nodig.
// Gebedstijden: `adhan` (vendor/adhan.umd.min.js, v4.4.6), Muslim World League, Leiden.
// Weer: Open-Meteo rechtstreeks. Achtergronden en adhaan: statische bestanden naast deze pagina.
(function () {
'use strict';

var TZ = 'Europe/Amsterdam';
var LAT = 52.1601, LON = 4.497;                 // Leiden (zelfde als server)
var NAMES = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
var ADHAN_FILE = 'adhan.mp3';
var ADHAN_SECONDS = 160;                        // zelfde als server: ADHAN_SECONDS
var ADHAN_WINDOW_MS = 120000;                   // alleen binnen 2 min na de tijd (geen gemiste adhaan achteraf)
var RELOAD_AT = { h: 3, m: 30 };                // nachtelijke herlaad (Amsterdam-tijd)
var params = new URLSearchParams(location.search);
var TEST = params.get('test');
var startedAt = Date.now();

// Achtergrondfoto's (zelfde lijst als assets/backgrounds/manifest.json). Auteur/licentie nog leeg: zie README.
var BGS = [
  { url: 'backgrounds/licht/01-leiden-hooglandse-kerk.jpg', mode: 'licht', title: 'Hooglandse Kerk, Leiden', author: '', license: '' },
  { url: 'backgrounds/licht/05-amsterdam-gracht.jpg', mode: 'licht', title: 'Gracht, Amsterdam', author: '', license: '' },
  { url: 'backgrounds/licht/04-amsterdam-skyline.jpg', mode: 'licht', title: 'Skyline, Amsterdam', author: '', license: '' },
  { url: 'backgrounds/licht/03-amsterdam-grachtenpanden-zonsondergang.jpg', mode: 'donker', title: 'Grachtenpanden, Amsterdam', author: '', license: '' },
  { url: 'backgrounds/donker/02-leiden-gracht-nacht.jpg', mode: 'donker', title: 'Gracht, Leiden', author: '', license: '' }
];

function $(id) { return document.getElementById(id); }

// ---------- Tijd en gebedstijden ----------
var hm = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
var dt = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
var hj = null; try { hj = new Intl.DateTimeFormat('nl-NL-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }); } catch (e) {}
var ymdFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
var hmFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

function amsDayKey(now) { return ymdFmt.format(now); }          // 'YYYY-MM-DD' in Amsterdam
function amsHM(now) { var p = hmFmt.format(now).split(':'); return { h: +p[0] % 24, m: +p[1] }; }

// Zelfde berekening als src/dashboard.js (prayerTimesFor), maar voor de kalenderdag in Amsterdam.
function prayerTimesFor(now) {
  var k = amsDayKey(now).split('-');
  var day = new Date(+k[0], +k[1] - 1, +k[2]);
  var coords = new adhan.Coordinates(LAT, LON);
  var p = adhan.CalculationMethod.MuslimWorldLeague();
  p.highLatitudeRule = adhan.HighLatitudeRule.recommended(coords);
  var t = new adhan.PrayerTimes(coords, day, p);
  return { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

var times = null, timesDay = null;
function loadTimes(now) { times = prayerTimesFor(now); timesDay = amsDayKey(now); }
loadTimes(new Date());
window.__times = function () { var o = {}; for (var k in times) o[k] = times[k].toISOString(); return o; };

function phase(now) {
  var h = 3600e3;
  if (now < times.fajr || now >= times.isha) return 'night';
  if (now < new Date(+times.sunrise + h)) return 'dawn';
  if (now < new Date(+times.maghrib - h)) return 'day';
  return 'dusk';
}

function tick() {
  var now = new Date();
  if (amsDayKey(now) !== timesDay) loadTimes(now);          // na middernacht opnieuw rekenen
  $('clock').textContent = hm.format(now);
  var ds = dt.format(now); $('date').textContent = ds.charAt(0).toUpperCase() + ds.slice(1);
  if (hj) $('hijri').textContent = hj.format(now);
  document.body.setAttribute('data-phase', phase(now));
  var keys = Object.keys(NAMES), next = null;
  for (var i = 0; i < keys.length; i++) { if (times[keys[i]] > now) { next = keys[i]; break; } }
  $('bar').innerHTML = keys.map(function (k) {
    var at = times[k];
    return '<div class="p' + (k === next ? ' on' : (at <= now ? ' past' : '')) + '"><div class="n">' + NAMES[k] + '</div><div class="t">' + hm.format(at) + '</div></div>';
  }).join('');
  if (next) {
    var m = Math.ceil((times[next] - now) / 60000), h = Math.floor(m / 60);
    $('nn').textContent = NAMES[next];
    $('nc').textContent = hm.format(times[next]) + ' · over ' + (h ? h + ' u ' + (m % 60) + ' min' : m + ' min');
  } else { $('nn').textContent = 'Fajr'; $('nc').textContent = 'morgen'; }
  nightlyReload(now);
}

// Elke nacht ~03:30 herladen zodat nieuwe versies binnenkomen (niet tijdens een adhaan; niet vlak na laden).
function nightlyReload(now) {
  var t = amsHM(now);
  if (t.h === RELOAD_AT.h && t.m >= RELOAD_AT.m && !audio && !TEST && Date.now() - startedAt > 30 * 60000) location.reload();
}

// ---------- Weer (Open-Meteo, 15 min cache) ----------
var I = {
  sun: '<circle cx="32" cy="32" r="11"/><g stroke-linecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4 4M45 45l4 4M15 49l4-4M45 19l4-4"/></g>',
  moon: '<path d="M42 44a16 16 0 0 1-14-26 16 16 0 1 0 22 22 16 16 0 0 1-8 4z"/>',
  cloud: '<path d="M20 46h26a10 10 0 0 0 0-20 14 14 0 0 0-27 3 9 9 0 0 0 1 17z"/>',
  rain: '<path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27 3 9 9 0 0 0 1 17z"/><path stroke-linecap="round" d="M24 46l-3 7M34 46l-3 7M44 46l-3 7"/>',
  snow: '<path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27 3 9 9 0 0 0 1 17z"/><g stroke-linecap="round"><path d="M24 48v6M21 51h6M38 48v6M35 51h6"/></g>',
  fog: '<path stroke-linecap="round" d="M14 26h36M10 34h44M16 42h32"/>',
  storm: '<path d="M20 36h26a10 10 0 0 0 0-20 14 14 0 0 0-27 3 9 9 0 0 0 1 17z"/><path stroke-linejoin="round" d="M34 40l-6 9h7l-5 9"/>',
  part: '<circle cx="24" cy="22" r="8"/><path d="M24 48h22a9 9 0 0 0 0-18 12 12 0 0 0-23 3 8 8 0 0 0 1 15z"/>'
};
var DESC = { 0: 'Helder', 1: 'Overwegend helder', 2: 'Half bewolkt', 3: 'Bewolkt', 45: 'Mist', 48: 'Mist', 51: 'Motregen', 53: 'Motregen', 55: 'Motregen', 61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen', 71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 80: 'Buien', 81: 'Buien', 82: 'Zware buien', 95: 'Onweer', 96: 'Onweer', 99: 'Onweer' };
function icon(c, day) {
  var k = c === 0 || c === 1 ? (day ? 'sun' : 'moon') : c === 2 ? (day ? 'part' : 'cloud') : c === 3 ? 'cloud' : c < 50 ? 'fog' : c < 70 || (c >= 80 && c < 83) ? 'rain' : c < 80 || c === 85 || c === 86 ? 'snow' : 'storm';
  return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6">' + I[k] + '</svg>';
}
var wx = null;
function renderWx() {
  var el = $('wx'); if (!wx || !wx.current) { el.innerHTML = ''; return; }
  var c = wx.current, d = wx.daily || {};
  el.innerHTML = '<div><div class="temp">' + Math.round(c.temperature_2m) + '°</div><div class="wxsub">' + (DESC[c.weather_code] || '') +
    (d.temperature_2m_max ? ' · ' + Math.round(d.temperature_2m_max[0]) + '° / ' + Math.round(d.temperature_2m_min[0]) + '°' : '') + '</div></div>' + icon(c.weather_code, c.is_day);
}
var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.16&longitude=4.50&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FAmsterdam&forecast_days=1';
function loadWx() {
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var to = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
  fetch(WX_URL, ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (j) { wx = j; }, function (e) { console.warn('[weer] mislukt:', e && e.message); })   // bij fout: laatste bekende waarde blijft staan
    .then(function () { if (to) clearTimeout(to); renderWx(); });
}

// ---------- Achtergronden ----------
var bgLayer = 0, bgIdx = { licht: -1, donker: -1 }, bgMode = null, bgTest = false;
function darkNow(now) { return now >= times.maghrib || now < times.fajr; }
function lum(r, g, b) { var a = [r, g, b].map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; }
function hsl2rgb(h, s, l) { s /= 100; l /= 100; var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l), f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); }; return [255 * f(0), 255 * f(8), 255 * f(4)].map(Math.round); }
// Dynamisch accent: levendigste tint uit de foto, lichtheid opgehoogd tot contrast >= 7:1 met navy tekst.
function accentFrom(img) {
  try {
    var c = document.createElement('canvas'), w = c.width = 48, h = c.height = 27, x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, bins = new Array(36).fill(0);
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
      if (dl < .12 || l < .12 || l > .92) continue; var sat = dl / (1 - Math.abs(2 * l - 1)), hh;
      if (mx === r) hh = ((g - b) / dl) % 6; else if (mx === g) hh = (b - r) / dl + 2; else hh = (r - g) / dl + 4; hh = (hh * 60 + 360) % 360;
      bins[Math.floor(hh / 10)] += sat * sat;
    }
    var best = 0; for (var j = 1; j < 36; j++) if (bins[j] > bins[best]) best = j;
    if (bins[best] < 1) return null;
    var hue = best * 10 + 5, inkL = lum(11, 21, 48), L = 62, rgb;
    do { rgb = hsl2rgb(hue, 88, L); L += 2; } while (((lum(rgb[0], rgb[1], rgb[2]) + .05) / (inkL + .05)) < 7 && L < 90);
    return 'rgb(' + rgb.join(',') + ')';
  } catch (e) { return null; }
}
function showBg(b) {
  var img = new Image(); img.onload = function () {
    var nxt = $('bg' + (1 - bgLayer)), cur = $('bg' + bgLayer);
    nxt.style.backgroundImage = 'url("' + b.url + '")'; nxt.classList.add('show'); cur.classList.remove('show'); bgLayer = 1 - bgLayer;
    document.body.classList.add('photo');
    var acc = accentFrom(img); if (acc) document.documentElement.style.setProperty('--accent', acc); else document.documentElement.style.removeProperty('--accent');
    $('credit').textContent = 'Foto: ' + b.title + (b.author ? ' · ' + b.author : '') + (b.license ? ' · ' + b.license : '');
  };
  img.onerror = function () { console.warn('[achtergrond] laden mislukt:', b.url); };
  img.src = b.url;
}
function nextBg() {
  var mode = darkNow(new Date()) ? 'donker' : 'licht', set = BGS.filter(function (b) { return b.mode === mode; });
  if (!set.length) set = BGS;
  bgMode = mode; bgIdx[mode] = (bgIdx[mode] + 1) % set.length; showBg(set[bgIdx[mode]]);
}
// Test: alle foto's 8 s per stuk tonen, daarna terug naar normaal.
function runBgTest() {
  if (bgTest) return; bgTest = true; var i = 0;
  (function step() { if (i >= BGS.length) { bgTest = false; nextBg(); return; } showBg(BGS[i++]); setTimeout(step, 8000); })();
}
setInterval(function () { if (!bgTest) nextBg(); }, 60 * 60 * 1000);                 // elk uur een volgende
setInterval(function () { var m = darkNow(new Date()) ? 'donker' : 'licht'; if (bgMode && m !== bgMode && !bgTest) nextBg(); }, 30 * 1000); // direct bij Maghrib/Fajr

// ---------- Adhaan (schermvullend, tik = stoppen, stopt zelf na einde) ----------
var ad = $('adhan'), audio = null, adhanTimer = null, played = {};
function adhanEnd(reason) {
  if (!audio) return;
  console.info('[adhaan] klaar (' + reason + ')');
  try { audio.pause(); } catch (e) {} audio.onended = audio.onerror = null; audio = null;
  clearTimeout(adhanTimer); ad.className = '';
}
function startAdhan(name, when) {
  if (audio) return;
  $('aname').textContent = name || '';
  $('atime').textContent = hm.format(when || new Date());
  ad.className = 'on';
  var a = audio = new Audio(ADHAN_FILE); a.volume = 1;
  a.onended = function () { adhanEnd('klaar'); };
  a.onerror = function () { console.warn('[adhaan] audio laden mislukt'); adhanEnd('fout'); };
  // Veiligheidstimer: overlay verdwijnt hoe dan ook (ook bij stille terugval of een vastlopende speler).
  adhanTimer = setTimeout(function () { adhanEnd('tijd om'); }, (ADHAN_SECONDS + 10) * 1000);
  var pr = a.play();
  if (pr && pr.catch) pr.catch(function (err) {
    // Autoplay geweigerd (gewone browser zonder klik): overlay blijft zichtbaar, zonder geluid.
    console.warn('[adhaan] play() geweigerd, overlay zonder geluid:', err && err.name);
  });
}
['click', 'touchstart', 'pointerdown'].forEach(function (ev) { ad.addEventListener(ev, function () { adhanEnd('getikt'); }); });

function adhanCheck() {
  var now = new Date();
  Object.keys(NAMES).forEach(function (k) {
    var t = times[k], id = t.toISOString().slice(0, 10) + '-' + k, late = now - t;
    if (late >= 0 && late < ADHAN_WINDOW_MS && !played[id]) {
      played[id] = true;
      console.info('[adhaan] ' + NAMES[k] + ' (' + hm.format(t) + ')');
      startAdhan(NAMES[k], t);
    }
  });
}

// ---------- Start ----------
tick(); setInterval(tick, 1000);
loadWx(); setInterval(loadWx, 15 * 60 * 1000);
if (TEST === 'bg') runBgTest(); else nextBg();
adhanCheck(); setInterval(adhanCheck, 15 * 1000);
if (TEST === 'adhan') startAdhan('Test');
})();
