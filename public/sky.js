/* lone-trail — draggable star field.
 * The stars are rendered locally so the background always works; the NASA
 * APOD image (fetched through /api/apod) is an optional layer behind them. */
(function () {
  'use strict';

  var canvas = document.getElementById('sky-canvas');
  var grab = document.getElementById('sky-grab');
  var hint = document.getElementById('sky-hint');
  var readout = document.getElementById('sky-readout');
  var apodLayer = document.getElementById('apod-layer');
  var apodCredit = document.getElementById('apod-credit');
  if (!canvas || !grab) return;

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- deterministic RNG so the sky is the same on every visit ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(20260918);
  function gauss() {
    var u = 1 - rng(), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- sky contents ---------- */
  var STAR_COLORS = [
    '#cfe0ff', '#dbe7ff', '#ffffff', '#fff3e0',
    '#ffe2bd', '#ffd0a6', '#bcd4ff', '#a9c4ff'
  ];

  // Basis for a tilted "galactic" band that the faint stars crowd around.
  var TILT = 1.05;
  var BAND_N = [Math.sin(TILT), Math.cos(TILT), 0];
  var BAND_U = [Math.cos(TILT), -Math.sin(TILT), 0];
  var BAND_V = [0, 0, 1];

  function makeStar(x, y, z, bright) {
    var len = Math.sqrt(x * x + y * y + z * z) || 1;
    var mag = Math.pow(rng(), bright ? 1.5 : 2.6);
    return {
      x: x / len, y: y / len, z: z / len,
      size: (bright ? 0.7 : 0.5) + mag * (bright ? 2.6 : 1.2),
      alpha: (bright ? 0.55 : 0.42) + mag * (bright ? 0.45 : 0.58),
      color: STAR_COLORS[(rng() * STAR_COLORS.length) | 0],
      phase: rng() * Math.PI * 2,
      speed: 0.0008 + rng() * 0.0022
    };
  }

  function buildStars(count) {
    var list = [];
    var i;
    // scattered over the whole sphere
    for (i = 0; i < count; i++) {
      var u = rng() * 2 - 1;
      var t = rng() * Math.PI * 2;
      var r = Math.sqrt(1 - u * u);
      list.push(makeStar(r * Math.cos(t), u, r * Math.sin(t), rng() > 0.965));
    }
    // concentrated along the band
    for (i = 0; i < (count * 1.15) | 0; i++) {
      var a = rng() * Math.PI * 2;
      var off = gauss() * 0.075;
      list.push(makeStar(
        Math.cos(a) * BAND_U[0] + Math.sin(a) * BAND_V[0] + off * BAND_N[0],
        Math.cos(a) * BAND_U[1] + Math.sin(a) * BAND_V[1] + off * BAND_N[1],
        Math.cos(a) * BAND_U[2] + Math.sin(a) * BAND_V[2] + off * BAND_N[2],
        rng() > 0.99
      ));
    }
    return list;
  }

  function buildClouds(count) {
    var list = [];
    for (var i = 0; i < count; i++) {
      var a = rng() * Math.PI * 2;
      var off = gauss() * 0.14;
      var x = Math.cos(a) * BAND_U[0] + Math.sin(a) * BAND_V[0] + off * BAND_N[0];
      var y = Math.cos(a) * BAND_U[1] + Math.sin(a) * BAND_V[1] + off * BAND_N[1];
      var z = Math.cos(a) * BAND_U[2] + Math.sin(a) * BAND_V[2] + off * BAND_N[2];
      var len = Math.sqrt(x * x + y * y + z * z) || 1;
      list.push({
        x: x / len, y: y / len, z: z / len,
        radius: 160 + rng() * 380,
        tint: ['110,140,255', '150,110,220', '90,170,210', '210,140,180'][(rng() * 4) | 0],
        alpha: 0.06 + rng() * 0.08
      });
    }
    return list;
  }

  var stars = [];
  var clouds = buildClouds(9);

  /* ---------- camera ---------- */
  var yaw = 0.6, pitch = 0.12;
  var vYaw = 0, vPitch = 0;
  var PITCH_LIMIT = 1.35;
  var DRIFT = calm ? 0 : 0.000018;   // radians per ms when idle

  var w = 0, h = 0, focal = 800, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    focal = Math.max(w, h) * 0.78;          // ~70 degree field of view

    // count covers the whole celestial sphere; roughly a sixth of it is on screen
    var wanted = Math.round(Math.min(7000, Math.max(2600, (w * h) / 150)));
    if (Math.abs(wanted - starTarget) > 250 || !stars.length) {
      starTarget = wanted;
      rng = mulberry32(20260918);
      stars = buildStars(wanted);
    }
  }
  var starTarget = 0;

  /* ---------- drag ---------- */
  var dragging = false, pointerId = null;
  var lastX = 0, lastY = 0, lastT = 0, hinted = false;

  function dismissHint() {
    if (hinted || !hint) return;
    hinted = true;
    hint.classList.add('is-hidden');
  }

  grab.addEventListener('pointerdown', function (e) {
    if (dragging) return;
    dragging = true;
    pointerId = e.pointerId;
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
    vYaw = vPitch = 0;
    grab.classList.add('is-dragging');
    if (e.pointerType !== 'touch') {
      try { grab.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    }
  });

  grab.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== pointerId) return;
    var dx = e.clientX - lastX;
    // On touch the browser owns vertical movement (page scroll), so only pan sideways.
    var dy = e.pointerType === 'touch' ? 0 : e.clientY - lastY;
    var dt = Math.max(1, e.timeStamp - lastT);
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;

    var dYaw = -dx / focal;
    var dPitch = -dy / focal;
    yaw += dYaw;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + dPitch));

    vYaw = dYaw / dt;
    vPitch = dPitch / dt;
    if (Math.abs(dx) + Math.abs(dy) > 4) dismissHint();
  });

  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    grab.classList.remove('is-dragging');
  }
  grab.addEventListener('pointerup', endDrag);
  grab.addEventListener('pointercancel', endDrag);
  grab.addEventListener('lostpointercapture', endDrag);

  grab.addEventListener('keydown', function (e) {
    var step = 0.08;
    if (e.key === 'ArrowLeft') yaw -= step;
    else if (e.key === 'ArrowRight') yaw += step;
    else if (e.key === 'ArrowUp') pitch = Math.min(PITCH_LIMIT, pitch + step);
    else if (e.key === 'ArrowDown') pitch = Math.max(-PITCH_LIMIT, pitch - step);
    else return;
    e.preventDefault();
    dismissHint();
  });

  /* ---------- render ---------- */
  var readoutAt = 0;

  function project(sx, sy, sz, cy, sy_, cp, sp) {
    // rotate world -> camera (yaw about Y, then pitch about X)
    var x1 = sx * cy - sz * sy_;
    var z1 = sx * sy_ + sz * cy;
    var y2 = sy * cp + z1 * sp;
    var z2 = z1 * cp - sy * sp;
    return z2 > 0.02 ? [x1, y2, z2] : null;
  }

  function draw(now) {
    var cy = Math.cos(yaw), sy_ = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var cx = w / 2, ccy = h / 2;
    var i, p, px, py;

    ctx.clearRect(0, 0, w, h);

    // faint nebulosity
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      p = project(c.x, c.y, c.z, cy, sy_, cp, sp);
      if (!p) continue;
      px = cx + (focal * p[0]) / p[2];
      py = ccy - (focal * p[1]) / p[2];
      var rad = c.radius;
      if (px < -rad || px > w + rad || py < -rad || py > h + rad) continue;
      var g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(' + c.tint + ',' + c.alpha + ')');
      g.addColorStop(1, 'rgba(' + c.tint + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }

    // stars
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      p = project(s.x, s.y, s.z, cy, sy_, cp, sp);
      if (!p) continue;
      px = cx + (focal * p[0]) / p[2];
      py = ccy - (focal * p[1]) / p[2];
      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;

      var a = s.alpha;
      if (!calm) a *= 0.78 + 0.22 * Math.sin(now * s.speed + s.phase);
      // fade stars near the edge of the projection, where it stretches
      a *= Math.min(1, p[2] * 1.6);
      if (a <= 0.02) continue;

      ctx.globalAlpha = a;
      ctx.fillStyle = s.color;
      if (s.size < 0.85) {
        ctx.fillRect(px, py, 1, 1);
      } else {
        ctx.beginPath();
        ctx.arc(px, py, s.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        if (s.size > 1.9) {
          var gr = s.size * 7;
          var gg = ctx.createRadialGradient(px, py, 0, px, py, gr);
          gg.addColorStop(0, 'rgba(255,255,255,0.16)');
          gg.addColorStop(0.35, 'rgba(255,255,255,0.05)');
          gg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gg;
          ctx.fillRect(px - gr, py - gr, gr * 2, gr * 2);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // parallax on the NASA layer
    if (apodLayer) {
      apodLayer.style.transform =
        'translate3d(' + (-Math.sin(yaw) * 26).toFixed(1) + 'px,' +
        (Math.sin(pitch) * 26).toFixed(1) + 'px,0)';
    }

    if (readout && now - readoutAt > 120) {
      readoutAt = now;
      var ra = (((yaw * 180) / Math.PI) % 360 + 360) % 360;
      var dec = (pitch * 180) / Math.PI;
      readout.textContent =
        'α ' + ra.toFixed(1) + '°  δ ' + (dec >= 0 ? '+' : '') + dec.toFixed(1) + '°';
    }
  }

  var prev = 0;
  function frame(now) {
    var dt = prev ? Math.min(64, now - prev) : 16;
    prev = now;

    if (!dragging) {
      if (Math.abs(vYaw) > 1e-7 || Math.abs(vPitch) > 1e-7) {
        yaw += vYaw * dt;
        pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + vPitch * dt));
        var decay = Math.exp(-dt / 260);
        vYaw *= decay;
        vPitch *= decay;
      } else {
        vYaw = vPitch = 0;
        yaw += DRIFT * dt;
      }
    }

    draw(now);
    raf = requestAnimationFrame(frame);
  }

  var raf = 0;
  function start() { if (!raf) { prev = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  resize();
  start();

  /* ---------- NASA APOD layer (optional) ---------- */
  function loadApod() {
    if (!apodLayer || !window.fetch) return;
    fetch('/api/apod', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (!data || !data.image) return;
        var img = new Image();
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.onload = function () {
          apodLayer.style.backgroundImage = 'url("' + data.image + '")';
          apodLayer.classList.add('is-ready');
          if (apodCredit) {
            apodCredit.textContent =
              'NASA APOD · ' + (data.title || '') +
              (data.date ? ' (' + data.date + ')' : '') +
              (data.credit ? ' · © ' + data.credit : '');
          }
        };
        img.src = data.image;
      })
      .catch(function () { /* no APOD today — the local star field stands alone */ });
  }
  loadApod();
})();
