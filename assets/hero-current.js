/*
  Slow Current: the hero's generative background (art/slow-current-philosophy.md).
  The same algorithm as art/slow-current-viewer.html, fixed at seed 1456 and tinted to the page's palette.
  Thousands of leafed stems ride a seeded flow field; the cursor and the headline block are stones in the
  stream, so the lines part around them and the words always sit on calm ground.
  Paused off screen and by its button; one still frame under reduced motion.
*/
(function () {
  "use strict";
  var host = document.querySelector("[data-current]");
  if (!host) return;

  var SEED = 1456, W = 1600, H = 900, MAXP = 64;
  var P = { speed: 1, lineCount: 2000, leafSpacing: 7, trail: 6, reach: 170,
            colors: ["#f7f9fa", "#1f3038", "#0d7480"] };   /* ground, stems, leaves: the page's --p-bg, --p-ink, --p-accent */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* p5.js 1.7.0's seeded random() and noise() (LGPL-2.1, processing/p5.js, src/math/random.js and
     src/math/noise.js), reproduced so seed 1456 grows the same field as the explorer without the library */
  var LCG_M = 4294967296, LCG_A = 1664525, LCG_C = 1013904223;
  var PERLIN_YWRAPB = 4, PERLIN_YWRAP = 1 << PERLIN_YWRAPB, PERLIN_ZWRAPB = 8, PERLIN_ZWRAP = 1 << PERLIN_ZWRAPB, PERLIN_SIZE = 4095;
  var p = {
    PI: Math.PI, TAU: Math.PI * 2,
    _state: null, _perlin: null, _octaves: 4, _falloff: 0.5,
    sin: Math.sin, floor: Math.floor,
    map: function (v, a, b, c, d) { return (v - a) / (b - a) * (d - c) + c; },
    randomSeed: function (seed) { this._state = seed >>> 0; },
    random: function (min, max) {
      var r = (this._state = (LCG_A * this._state + LCG_C) % LCG_M) / LCG_M;
      if (min === undefined) return r;
      if (max === undefined) return r * min;
      if (min > max) { var tmp = min; min = max; max = tmp; }
      return r * (max - min) + min;
    },
    noiseDetail: function (lod, falloff) { if (lod > 0) this._octaves = lod; if (falloff > 0) this._falloff = falloff; },
    noiseSeed: function (seed) {
      var z = seed >>> 0; this._perlin = new Array(PERLIN_SIZE + 1);
      for (var i = 0; i < PERLIN_SIZE + 1; i++) { z = (LCG_A * z + LCG_C) % LCG_M; this._perlin[i] = z / LCG_M; }
    },
    noise: function (x, y, z) {
      var perlin = this._perlin, cos = function (i) { return 0.5 * (1 - Math.cos(i * Math.PI)); };
      if (x < 0) x = -x; if (y < 0) y = -y; if (z < 0) z = -z;
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
      var r = 0, ampl = 0.5, n1, n2, n3, rxf, ryf;
      for (var o = 0; o < this._octaves; o++) {
        var of = xi + (yi << PERLIN_YWRAPB) + (zi << PERLIN_ZWRAPB);
        rxf = cos(xf); ryf = cos(yf);
        n1 = perlin[of & PERLIN_SIZE]; n1 += rxf * (perlin[of + 1 & PERLIN_SIZE] - n1);
        n2 = perlin[of + PERLIN_YWRAP & PERLIN_SIZE]; n2 += rxf * (perlin[of + PERLIN_YWRAP + 1 & PERLIN_SIZE] - n2);
        n1 += ryf * (n2 - n1);
        of += PERLIN_ZWRAP;
        n2 = perlin[of & PERLIN_SIZE]; n2 += rxf * (perlin[of + 1 & PERLIN_SIZE] - n2);
        n3 = perlin[of + PERLIN_YWRAP & PERLIN_SIZE]; n3 += rxf * (perlin[of + PERLIN_YWRAP + 1 & PERLIN_SIZE] - n3);
        n2 += ryf * (n3 - n2);
        n1 += cos(zf) * (n2 - n1);
        r += n1 * ampl; ampl *= this._falloff;
        xi <<= 1; xf *= 2; yi <<= 1; yf *= 2; zi <<= 1; zf *= 2;
        if (xf >= 1) { xi++; xf--; } if (yf >= 1) { yi++; yf--; } if (zf >= 1) { zi++; zf--; }
      }
      return r;
    }
  };

  (function () {
    var carriers = [], field = {}, t = 0;
    var cursor = null;          /* canvas-space point, or null */
    var calm = null;            /* canvas-space rect behind the headline */
    var running = !reduced, visible = true;
    var view = { s: 1, ox: 0, oy: 0 };

    function flowAngle(x, y) {
      var n = p.noise(x * field.scale, y * field.scale, t * field.drift);
      var wave = p.sin(field.k * x - t * 0.55) + p.sin(field.k * x - t * 0.58 + y * 0.0015);
      return field.dir + (n - 0.5) * field.twist * p.PI + wave * field.beat;
    }

    function Carrier(anywhere) {
      this.xs = new Float32Array(MAXP); this.ys = new Float32Array(MAXP);
      this.spawn(anywhere);
    }
    Carrier.prototype.spawn = function (anywhere) {
      var upstream = !anywhere && p.random() < 0.65;
      this.x = upstream ? p.random(-30, W * 0.12) : p.random(W);
      this.y = p.random(-30, H + 30);
      this.head = 0; this.n = 0;
      this.age = p.floor(p.random(1000));
      this.left = p.floor(p.random(180, 560));
      this.pace = p.random(0.75, 1.25);
      this.tint = p.random() < 0.8 ? 0 : 1;
      this.strong = p.random() < 0.45;
      this.leaf = p.random(4.5, 8);
      this.dying = false;
      if (calm && inside(this.x, this.y, 0)) this.dying = true;   /* never born on the words */
    };
    Carrier.prototype.push = function (x, y) {
      this.xs[this.head] = x; this.ys[this.head] = y;
      this.head = (this.head + 1) % MAXP;
      if (this.n < MAXP) this.n++;
    };
    Carrier.prototype.at = function (i) { return (this.head - 1 - i + MAXP) % MAXP; };
    Carrier.prototype.move = function (len) {
      if (!this.dying) {
        var a = flowAngle(this.x, this.y), vx = Math.cos(a), vy = Math.sin(a), d, f, k, m;
        if (cursor) {                                   /* the cursor: a stone, quadratic falloff */
          var dx = this.x - cursor.x, dy = this.y - cursor.y, d2 = dx * dx + dy * dy, r = P.reach;
          if (d2 < r * r && d2 > 0.01) { d = Math.sqrt(d2); f = 1 - d / r; k = f * f * 2.6; vx += dx / d * k; vy += dy / d * k; }
        }
        if (calm) {                                     /* the headline block: a wider, flatter stone */
          var cx = Math.max(calm.x0, Math.min(this.x, calm.x1)), cy = Math.max(calm.y0, Math.min(this.y, calm.y1));
          var ex = this.x - cx, ey = this.y - cy, de = Math.hypot(ex, ey), M = 120;
          if (de === 0) {                               /* inside: leave by the nearest edge */
            var l = this.x - calm.x0, rr = calm.x1 - this.x, tp = this.y - calm.y0, bt = calm.y1 - this.y, mn = Math.min(l, rr, tp, bt);
            ex = mn === l ? -1 : mn === rr ? 1 : 0; ey = mn === tp ? -1 : mn === bt ? 1 : 0; de = 1; vx += ex * 3; vy += ey * 3;
          } else if (de < M) { f = 1 - de / M; k = f * f * 3.2; vx += ex / de * k; vy += ey / de * k; }
        }
        m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m;
        var s = 1.5 * P.speed * this.pace;
        this.x += vx * s; this.y += vy * s;
        this.push(this.x, this.y);
        this.age++;
        if (--this.left <= 0 || this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) this.dying = true;
      }
      var target = this.dying ? this.n - 2 : len;
      if (this.n > target) this.n = Math.max(0, Math.min(this.n, target));
      if (this.dying && this.n <= 1) this.spawn(false);
    };

    function inside(x, y, pad) { return calm && x > calm.x0 - pad && x < calm.x1 + pad && y > calm.y0 - pad && y < calm.y1 + pad; }

    function init() {
      p.randomSeed(SEED); p.noiseSeed(SEED); p.noiseDetail(3, 0.45);
      field = { dir: p.random(-0.28, 0.28), scale: p.random(0.0011, 0.0021), twist: p.random(1.6, 2.4),
                drift: p.random(0.018, 0.032), k: p.TAU * p.random(1.5, 3) / W, beat: p.random(0.16, 0.26) };
      carriers = [];
      for (var i = 0; i < P.lineCount; i++) carriers.push(new Carrier(true));
      t = 0;
      for (var j = 0; j < 160; j++) step();
    }

    function trailLen() { return Math.round(p.map(P.trail, 1, 10, 8, MAXP)); }
    function step() { t += 0.016 * P.speed; var len = trailLen(); for (var i = 0; i < carriers.length; i++) carriers[i].move(len); }

    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + (a / 255).toFixed(3) + ")";
    }

    function render() {
      var ctx = cctx, d = density;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = P.colors[0]; ctx.fillRect(0, 0, W, H);
      var stems = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], leafs = [new Path2D(), new Path2D()];
      var sp = P.leafSpacing;
      for (var ci = 0; ci < carriers.length; ci++) {
        var c = carriers[ci]; if (c.n < 2) continue;
        var path = stems[c.tint * 2 + (c.strong ? 1 : 0)], lp = leafs[c.tint], j = c.at(0);
        path.moveTo(c.xs[j], c.ys[j]);
        for (var i = 1; i < c.n; i++) {
          var k = c.at(i), x = c.xs[k], y = c.ys[k];
          path.lineTo(x, y);
          var stepNo = c.age - i;
          if (stepNo % sp === 0 && i < c.n - 1) {
            var h = Math.atan2(c.ys[j] - y, c.xs[j] - x), side = (Math.floor(stepNo / sp) & 1) ? 1 : -1;
            var a = h + side * 0.66, L = c.leaf, w = L * 0.34, ca = Math.cos(a), sa = Math.sin(a);
            var mx = x + ca * L * 0.5, my = y + sa * L * 0.5;
            lp.moveTo(x, y);
            lp.quadraticCurveTo(mx - sa * w, my + ca * w, x + ca * L, y + sa * L);
            lp.quadraticCurveTo(mx + sa * w, my - ca * w, x, y);
          }
          j = k;
        }
      }
      ctx.lineWidth = 0.75; ctx.lineJoin = "round"; ctx.lineCap = "round";
      [[1, 70], [1, 120], [2, 90], [2, 140]].forEach(function (b, i) { ctx.strokeStyle = rgba(P.colors[b[0]], b[1]); ctx.stroke(stems[i]); });
      [[2, 170], [1, 110]].forEach(function (b, i) { ctx.fillStyle = rgba(P.colors[b[0]], b[1]); ctx.fill(leafs[i]); });
      if (calm) {                                         /* calm ground behind the words: the page colour with a soft edge */
        ctx.save();
        ctx.fillStyle = P.colors[0]; ctx.shadowColor = P.colors[0]; ctx.shadowBlur = 40 * d;
        ctx.fillRect(calm.x0, calm.y0, calm.x1 - calm.x0, calm.y1 - calm.y0);
        ctx.restore();
      }
    }

    /* the canvas is W x H, shown with object-fit: cover; these map page points into it */
    function measure() {
      var r = host.getBoundingClientRect();
      view.s = Math.max(r.width / W, r.height / H);
      view.ox = (r.width - W * view.s) / 2; view.oy = (r.height - H * view.s) / 2;
      var txt = document.querySelector(".hero .hero__grid > .span-3:first-child");
      if (txt) {
        var b = txt.getBoundingClientRect(), pad = 24;
        calm = { x0: (b.left - r.left - view.ox) / view.s - pad, y0: (b.top - r.top - view.oy) / view.s - pad,
                 x1: (b.right - r.left - view.ox) / view.s + pad, y1: (b.bottom - r.top - view.oy) / view.s + pad };
      }
    }
    function toCanvas(e) {
      var r = host.getBoundingClientRect();
      return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
    }

    var density = Math.min(window.devicePixelRatio || 1, 1.5), raf = 0;
    var canvas = host;                                   /* the hero's <canvas data-current> layer */
    canvas.width = Math.round(W * density); canvas.height = Math.round(H * density);
    var cctx = canvas.getContext("2d");
    measure();
    init();
    render();

    function frame() { raf = 0; step(); render(); if (running && visible) raf = requestAnimationFrame(frame); }
    function isLooping() { return !!raf; }
    function sync() {
      if (running && visible) { if (!raf) raf = requestAnimationFrame(frame); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    sync();
    var section = host.closest("section") || host.parentElement;
    if (!reduced) {
      section.addEventListener("pointermove", function (e) { if (e.pointerType !== "touch") cursor = toCanvas(e); });
      section.addEventListener("pointerleave", function () { cursor = null; });
    }
    window.addEventListener("resize", function () { measure(); if (!running) render(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); if (!running) render(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }).observe(host);
    }
    var btn = document.querySelector("[data-current-pause]");
    if (btn) {
      if (reduced) btn.hidden = true;
      btn.addEventListener("click", function () {
        running = !running; sync();
        btn.setAttribute("aria-pressed", String(!running));
        btn.setAttribute("aria-label", running ? "Pause the background animation" : "Play the background animation");
        btn.classList.toggle("is-paused", !running);
      });
    }
    window.__slowCurrent = { seed: SEED, isLooping: isLooping, calm: function () { return calm; } };
  })();
})();
