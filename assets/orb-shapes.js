/*
  Shapes: the liquid orb below the hero (the page's one big scene, #shapes).

  One glowing, liquid body in Three.js that breathes slowly and takes a different shape for each soundscape as
  the page scrolls: a drop for Rain, four leaves for Forest, a ringed planet for Deep Space. GSAP ScrollTrigger
  scrubs one timeline over the section's held screens; the same timeline moves the shape, the progress steps
  and each soundscape's words, so they can never drift apart.

  Live only when <html> carries .orb-live (set in <head> unless the reader prefers reduced motion). At rest
  (reduced motion, no script, GSAP missing) the section shows all three soundscapes and one still orb.
  WebGL is taken only when the section is within a screen of the viewport; the loop runs only while it is on
  screen and not paused. If WebGL fails, a still disc stays in its place.
*/
const root = document.querySelector('[data-big-scene="liquid-orb"]');
const html = document.documentElement;

if (root) {
  const canvas = root.querySelector('[data-orb]');
  const view = root.querySelector('.orb__view');
  const pauseBtn = root.querySelector('[data-orb-pause]');
  const chapters = [...root.querySelectorAll('[data-ch]')];
  const steps = [...root.querySelectorAll('[data-step]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const live = html.classList.contains('orb-live') && !reduce && !!gsap && !!ST;
  if (!live) html.classList.remove('orb-live');

  // the shape the orb is in: 0 Rain, 1 Forest, 2 Deep Space (fractions are the morph between two)
  const state = { m: 0 };
  let orb = null, visible = false, paused = false, raf = 0, last = 0, time = 0;

  const frame = (now) => {
    raf = 0;
    if (!orb) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (live && !paused) time += dt;
    orb.draw(time, state.m);
    if (live && visible && !paused) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && orb && (visible || !live)) { last = 0; raf = requestAnimationFrame(frame); } };

  // ---------------------------------------------------------------- the scroll timeline (text and shape together)
  if (live) {
    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });
    const parts = (ch) => [ch.querySelector('h3 > span'), ...ch.querySelectorAll('p, li')];
    chapters.forEach((ch, i) => {
      gsap.set(ch.querySelector('h3 > span'), { yPercent: i ? 110 : 0 });
      // the words wipe in and out behind a mask at full colour (never a faded grey), and are hidden once wiped
      gsap.set(ch.querySelectorAll('p, li'), { y: i ? 20 : 0, clipPath: i ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 0% 0%)', visibility: i ? 'hidden' : 'visible' });
      ch.classList.toggle('is-current', i === 0);
    });
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true,
        onUpdate: kick,
      },
      onUpdate() {
        const k = Math.round(state.m);
        chapters.forEach((ch, i) => ch.classList.toggle('is-current', i === k));
        steps.forEach((s, i) => s.classList.toggle('is-current', i === k));
        kick();
      },
    });
    // 10 units over one held screen: a short hold on each soundscape, a morph between them; the words hand over at the morph's middle
    const morphs = [[1.1, 4.5], [5.5, 8.9]];
    morphs.forEach(([a, b], i) => {
      const out = chapters[i], inn = chapters[i + 1], mid = (a + b) / 2;
      tl.to(state, { m: i + 1, duration: b - a, ease: 'power2.inOut' }, a);
      tl.to(out.querySelector('h3 > span'), { yPercent: -110, duration: mid - a - 0.15, ease: 'power2.in' }, a);
      tl.to(out.querySelectorAll('p, li'), { y: -16, clipPath: 'inset(0% 0% 100% 0%)', duration: mid - a - 0.3, stagger: 0.06, ease: 'power1.in' }, a);
      tl.set(out.querySelectorAll('p, li'), { visibility: 'hidden' }, mid);
      tl.set(inn.querySelectorAll('p, li'), { visibility: 'visible' }, mid + 0.01);
      tl.fromTo(inn.querySelector('h3 > span'), { yPercent: 110 }, { yPercent: 0, duration: b - mid - 0.15, ease: 'power2.out', immediateRender: false }, mid + 0.15);
      tl.fromTo(inn.querySelectorAll('p, li'), { y: 20, clipPath: 'inset(100% 0% 0% 0%)' }, { y: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: b - mid - 0.3, stagger: 0.06, ease: 'power2.out', immediateRender: false }, mid + 0.3);
    });
    // each step's bar fills across its soundscape's share of the scroll
    const spans = [[0, 2.8], [2.8, 7.2], [7.2, 10]];
    steps.forEach((s, i) => tl.fromTo(s.querySelector('b'), { scaleX: 0 }, { scaleX: 1, duration: spans[i][1] - spans[i][0] }, spans[i][0]));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
    addEventListener('load', () => ST.refresh(), { once: true });
  }

  // ---------------------------------------------------------------- pause (the breath and the flow; scroll still moves the shape)
  if (pauseBtn) pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.setAttribute('aria-label', paused ? 'Play the orb animation' : 'Pause the orb animation');
    pauseBtn.classList.toggle('is-paused', paused);
    kick();
  });

  // ---------------------------------------------------------------- WebGL: taken near the screen, looped only on it
  let booting = false;
  const boot = async () => {
    if (booting || orb) return;
    booting = true;
    try {
      const THREE = await import('./vendor/three-0.160.0.module.min.js');
      const o = makeOrb(THREE, canvas, view);
      o.draw(0, state.m);
      if (!o.linked()) throw new Error('the orb shader did not link');
      orb = o;
      root.classList.add('has-gl');
      kick();
    } catch (err) {
      root.classList.add('no-gl');
      canvas.style.display = 'none';
    }
  };
  new IntersectionObserver((es) => { if (es[0].isIntersecting) boot(); }, { rootMargin: '100% 0px' }).observe(root);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(view);
  new ResizeObserver(() => { if (orb) { orb.resize(); kick(); } }).observe(view);

  window.__liquidOrb = { state, get looping() { return !!raf; }, get ready() { return !!orb; }, get paused() { return paused; } };
}

// ================================================================== the orb
function makeOrb(THREE, canvas, host) {
  const small = matchMedia('(max-width: 767px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  // the palette's own colours, one set per soundscape: core, glow, rim
  const C = (hex) => new THREE.Color(hex);
  const SETS = [
    { core: C('#0d7480'), glow: C('#7fc6cd'), rim: C('#f7f9fa'), rx: 0.08, rz: 0.0 },   // Rain: a drop, tip up
    { core: C('#0d7480'), glow: C('#0d7480'), rim: C('#7fc6cd'), rx: 1.02, rz: 0.0 },   // Forest: four leaves, seen from above
    { core: C('#1f3038'), glow: C('#7fc6cd'), rim: C('#f7f9fa'), rx: 0.36, rz: -0.32 }, // Deep Space: a planet and its ring
  ];

  const uniforms = {
    uTime: { value: 0 },
    uW: { value: new THREE.Vector3(1, 0, 0) },
    uCore: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uRim: { value: new THREE.Color() },
  };

  const noiseGlsl = /* glsl */`
    vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute4(vec4 x) { return mod289v4(((x * 34.0) + 10.0) * x); }
    vec4 invSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise3(vec3 v) {
      const vec2 C2 = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D4 = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C2.yyy));
      vec3 x0 = v - i + dot(i, C2.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C2.xxx;
      vec3 x2 = x0 - i2 + C2.yyy;
      vec3 x3 = x0 - D4.yyy;
      i = mod289v3(i);
      vec4 p = permute4(permute4(permute4(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D4.wyz - D4.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = invSqrt4(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }`;

  const vertexShader = /* glsl */`
    uniform float uTime;
    uniform vec3 uW;
    varying vec3 vNrm;
    varying vec3 vPosV;
    varying float vDepthGlow;
    ${noiseGlsl}

    // the body for one direction on the unit sphere: a blend of the three soundscapes' shapes
    vec3 bodyAt(vec3 n) {
      float t = uTime;
      float up = n.y;
      vec3 pos = vec3(0.0);
      if (uW.x > 0.001) {
        // Rain: a drop, narrowing to its tip, with rings running down it
        float waist = 1.0 - 0.66 * pow(smoothstep(-0.4, 1.0, up), 1.7);
        vec3 pr = vec3(n.x * waist, up * 1.14 + 0.05, n.z * waist);
        pr += n * 0.007 * sin(up * 18.0 - t * 1.6) * (1.0 - smoothstep(0.1, 0.8, up));
        pos += pr * uW.x;
      }
      if (uW.y > 0.001) {
        // Forest: four leaves around the stem, a crease between each, a flutter of wind
        float ang = atan(n.z, n.x);
        float leaf = pow(abs(cos(2.0 * ang)), 0.6);
        float girth = sqrt(max(0.0, 1.0 - up * up));
        float rad = 0.7 + 0.46 * leaf * girth;
        vec3 pf = vec3(n.x * rad, up * 0.56, n.z * rad);
        pf -= n * 0.07 * pow(1.0 - leaf, 5.0) * girth;
        pf += n * 0.03 * girth * snoise3(n * 2.4 + vec3(0.0, t * 0.32, t * 0.18));
        pos += pf * uW.y;
      }
      if (uW.z > 0.001) {
        // Deep Space: a smaller, rounder planet with slow bands across it (its ring is its own mesh)
        vec3 ps = n * 0.72;
        ps += n * 0.006 * sin(up * 22.0 + 1.4 * snoise3(n * 1.6 + vec3(t * 0.05)));
        pos += ps * uW.z;
      }
      // the liquid: one slow flowing swell over every shape (calm on the drop's tip), and the breath (about 7 s in, 7 s out)
      float swell = snoise3(n * 1.2 + vec3(t * 0.11, t * 0.08, -t * 0.09));
      float calmTip = 1.0 - uW.x * smoothstep(0.2, 0.9, up);
      float amp = 0.045 * calmTip * (1.0 - 0.55 * uW.z);
      float breath = 1.0 + 0.045 * sin(t * 0.45);
      return pos * breath + n * swell * amp;
    }

    void main() {
      vec3 n = normalize(position);
      vec3 helper = abs(n.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 t1 = normalize(cross(n, helper));
      vec3 t2 = cross(n, t1);
      float e = 0.006;
      vec3 p0 = bodyAt(n);
      vec3 p1 = bodyAt(normalize(n + t1 * e));
      vec3 p2 = bodyAt(normalize(n + t2 * e));
      vec3 nrm = normalize(cross(p1 - p0, p2 - p0));
      if (dot(nrm, p0) < 0.0) nrm = -nrm;
      vec4 mv = modelViewMatrix * vec4(p0, 1.0);
      vPosV = mv.xyz;
      vNrm = normalize(normalMatrix * nrm);
      vDepthGlow = length(p0);
      gl_Position = projectionMatrix * mv;
    }`;

  const fragmentShader = /* glsl */`
    uniform float uTime;
    uniform vec3 uCore;
    uniform vec3 uGlow;
    uniform vec3 uRim;
    varying vec3 vNrm;
    varying vec3 vPosV;
    varying float vDepthGlow;

    void main() {
      vec3 nrm = normalize(vNrm);
      vec3 toEye = normalize(-vPosV);
      float facing = max(dot(nrm, toEye), 0.0);
      float fres = pow(1.0 - facing, 2.6);
      // a wet surface: a soft sky above, the dark room below, one window card caught in it
      vec3 refl = reflect(-toEye, nrm);
      float sky = smoothstep(-0.3, 0.95, refl.y);
      vec3 room = mix(uCore * 0.22, mix(uGlow, uRim, 0.35), sky);
      float pane = smoothstep(0.45, 0.8, refl.y) * (1.0 - smoothstep(0.18, 0.55, abs(refl.x + 0.28)));
      vec3 keyDir = normalize(vec3(-0.45, 0.75, 0.55));
      vec3 halfV = normalize(keyDir + toEye);
      float spec = pow(max(dot(nrm, halfV), 0.0), 110.0);
      float diff = max(dot(nrm, keyDir), 0.0);
      // light held inside the liquid: strongest where you look straight in
      float inner = pow(facing, 1.8) * (0.75 + 0.25 * sin(uTime * 0.45));
      vec3 col = uCore * (0.22 + 0.38 * diff);
      col += uGlow * inner * 0.5;
      col = mix(col, room, 0.14 + 0.36 * fres);
      col += uRim * fres * 1.05;
      col += vec3(1.0) * (spec * 0.8 + pane * 0.18);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`;

  const segW = small ? 144 : 256, segH = small ? 112 : 200;
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const body = new THREE.Mesh(geo, mat);
  const tilt = new THREE.Group();
  tilt.add(body);
  scene.add(tilt);

  // Deep Space's ring: a thin banded disc of light that opens out of the planet's waist
  const ringU = { uTime: uniforms.uTime, uGlow: uniforms.uGlow, uRim: uniforms.uRim, uRing: { value: 0 } };
  const ringGeo = new THREE.RingGeometry(1.08, 1.62, 256, 4);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
    uniforms: ringU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`varying float vRad; void main() { vRad = length(position.xz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uGlow; uniform vec3 uRim; uniform float uRing; varying float vRad;
      void main() {
        float k = (vRad - 1.08) / 0.54;
        float edge = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.9, 1.0, k));
        float gap = 1.0 - 0.85 * exp(-pow((k - 0.62) / 0.025, 2.0));
        float bands = 0.6 + 0.4 * sin(k * 46.0) * sin(k * 13.0 + 1.3);
        float a = edge * gap * bands * uRing * (0.5 + 0.04 * sin(uTime * 0.45));
        vec3 col = mix(uGlow, uRim, 0.4 + 0.4 * k);
        gl_FragColor = vec4(col * a, a);
        #include <colorspace_fragment>
      }`,
  }));
  ring.visible = false;
  tilt.add(ring);

  // the glow the orb sits in: one additive disc behind it
  const haloU = { uTime: uniforms.uTime, uGlow: uniforms.uGlow, uLift: { value: 1 } };
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.ShaderMaterial({
      uniforms: haloU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uGlow; uniform float uLift; varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float a = exp(-d * d * 3.2) * (1.0 - smoothstep(0.55, 1.0, d)) * (0.5 + 0.08 * sin(uTime * 0.45)) * uLift;
          gl_FragColor = vec4(uGlow * a, a);
          #include <colorspace_fragment>
        }`,
    }),
  );
  halo.position.z = -1.6;
  scene.add(halo);

  const lerp = (a, b, f) => a + (b - a) * f;
  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole orb (and its ring) in frame on a narrow view
    camera.position.z = 6 / Math.min(1, camera.aspect * 1.05);
    camera.updateProjectionMatrix();
  };
  resize();

  const draw = (t, m) => {
    const i = Math.min(1, Math.floor(m)), f = m - i;
    const a = SETS[i], b = SETS[i + 1];
    const w = [0, 0, 0]; w[i] = 1 - f; w[i + 1] = f;
    uniforms.uW.value.set(w[0], w[1], w[2]);
    uniforms.uTime.value = t;
    uniforms.uCore.value.copy(a.core).lerp(b.core, f);
    uniforms.uGlow.value.copy(a.glow).lerp(b.glow, f);
    uniforms.uRim.value.copy(a.rim).lerp(b.rim, f);
    haloU.uLift.value = lerp(i === 1 ? 0.8 : 1, i === 0 ? 0.8 : 1.05, f);
    const rw = w[2] * w[2] * (3 - 2 * w[2]);
    ringU.uRing.value = rw;
    ring.visible = rw > 0.002;
    ring.scale.setScalar(0.55 + 0.45 * rw);
    ring.rotation.y = -t * 0.05;
    tilt.rotation.x = lerp(a.rx, b.rx, f);
    tilt.rotation.z = lerp(a.rz, b.rz, f);
    body.rotation.y = t * 0.12 + m * 0.9;
    tilt.position.y = 0.05 * Math.sin(t * 0.45 + 1.2);
    renderer.render(scene, camera);
  };

  // true when every program the orb drew with compiled and linked (a strict GPU can reject a shader)
  const linked = () => {
    const gl = renderer.getContext();
    return [mat, halo.material, ring.material].every((m) => {
      const prog = renderer.properties.get(m).currentProgram;
      if (!prog) return m === ring.material;   // the ring is drawn only for Deep Space
      return !!gl.getProgramParameter(prog.program, gl.LINK_STATUS);
    });
  };

  return { draw, resize, renderer, linked };
}
