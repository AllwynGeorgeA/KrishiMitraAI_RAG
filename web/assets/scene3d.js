// KrishiMitra 3D backdrop: a slow flyover of patchwork farmland at dusk.
// Fixed full-screen canvas behind the UI (z-index -1, no pointer events).
// Pauses when the tab is hidden, renders one still frame under
// prefers-reduced-motion, and quietly does nothing if WebGL is unavailable,
// in which case the page keeps its plain CSS background.
import * as THREE from '../vendor/three.module.min.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = matchMedia('(max-width: 768px), (pointer: coarse)').matches;

const HORIZON = new THREE.Color('#0b2414');

function makeRenderer(canvas) {
  try {
    const r = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, alpha: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1 : 1.5));
    r.setClearColor(0x000000, 0);
    return r;
  } catch {
    return null;
  }
}

function makeTerrain() {
  const seg = isSmall ? 90 : 200;
  const geo = new THREE.PlaneGeometry(260, 200, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -80);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: HORIZON },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vH;
      varying vec2 vW;
      varying float vDepth;

      float heightAt(vec2 p) {
        float h = sin(p.x * 0.08) * cos(p.y * 0.06) * 2.4
                + sin(p.x * 0.21 + p.y * 0.13) * 0.9
                + sin(p.y * 0.37 - p.x * 0.05) * 0.35;
        // Flat valley down the middle (where the UI text sits), hills at the sides.
        return h * (0.35 + smoothstep(10.0, 70.0, abs(p.x)) * 2.2) + smoothstep(40.0, 120.0, abs(p.x)) * 9.0;
      }

      void main() {
        vec2 w = vec2(position.x, position.z - uTime * 2.2);
        vec3 p = position;
        p.y = heightAt(w);
        vH = p.y;
        vW = w;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      varying float vH;
      varying vec2 vW;
      varying float vDepth;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 g = (vW + vec2(7.0, 0.0)) / 14.0;
        vec2 cell = floor(g);
        vec2 local = fract(g);
        float h = hash(cell);

        // Each field has its own crop tone and row direction.
        vec3 crop = mix(vec3(0.03, 0.10, 0.05), vec3(0.07, 0.19, 0.09), h);
        crop = mix(crop, vec3(0.13, 0.15, 0.05), step(0.82, h)); // occasional ripening wheat field
        vec3 col = mix(crop * 0.7, crop * 1.25, smoothstep(-1.0, 4.0, vH));

        float rowCoord = (h > 0.5 ? local.x : local.y) * 14.0;
        float row = 1.0 - smoothstep(0.0, 0.12, abs(fract(rowCoord * 0.8) - 0.5) - 0.34);
        col += vec3(0.13, 0.77, 0.37) * row * 0.10;

        // Glowing field boundaries (irrigation channels / bunds).
        vec2 edge = min(local, 1.0 - local);
        float border = 1.0 - smoothstep(0.0, 0.018, min(edge.x, edge.y));
        col += vec3(0.29, 0.87, 0.50) * border * 0.35;

        float fog = smoothstep(18.0, 150.0, vDepth);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
      }
    `,
  });
  return { mesh: new THREE.Mesh(geo, mat), mat };
}

function makePollen() {
  const count = isSmall ? 260 : 700;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 130;
    pos[i * 3 + 1] = 0.6 + Math.random() * 16;
    pos[i * 3 + 2] = -140 + Math.random() * 150;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: window.innerHeight / 2 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScale;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.z = mod(p.z + 140.0 + uTime * 2.2, 150.0) - 140.0;   // drifts toward the camera, wraps
        p.y += sin(uTime * 0.6 + aSeed) * 0.6;
        p.x += cos(uTime * 0.4 + aSeed * 1.3) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float twinkle = 0.55 + 0.45 * sin(uTime * 2.0 + aSeed * 7.0);
        vAlpha = twinkle * (1.0 - smoothstep(60.0, 140.0, -mv.z)) * smoothstep(8.0, 22.0, -mv.z);
        gl_PointSize = (0.35 + fract(aSeed) * 0.6) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(0.73, 0.97, 0.80, a * 0.8);
      }
    `,
  });
  return { points: new THREE.Points(geo, mat), mat };
}

function makeSun() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float core = smoothstep(0.22, 0.18, d);
        float halo = pow(max(0.0, 1.0 - d), 3.0);
        vec3 col = mix(vec3(0.30, 0.85, 0.45), vec3(0.99, 0.90, 0.54), core);
        gl_FragColor = vec4(col, core * 0.4 + halo * 0.2);
      }
    `,
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat);
  sun.position.set(-110, 22, -175);
  return sun;
}

function start() {
  const canvas = document.createElement('canvas');
  canvas.id = 'km3d';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const renderer = makeRenderer(canvas);
  if (!renderer) { canvas.remove(); return; }
  document.documentElement.classList.add('km3d-on');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
  const lookAt = new THREE.Vector3(0, 3.5, -40);
  const base = new THREE.Vector3(0, 7, 14);
  camera.position.copy(base);

  const terrain = makeTerrain();
  const pollen = makePollen();
  scene.add(makeSun(), terrain.mesh, pollen.points);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = e.clientX / window.innerWidth - 0.5;
    pointer.ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pollen.mat.uniforms.uScale.value = h / 2;
    if (reduceMotion) frame(0);
  }

  const clock = new THREE.Clock();
  let elapsed = 0;
  function frame(dt) {
    elapsed += dt;
    terrain.mat.uniforms.uTime.value = elapsed;
    pollen.mat.uniforms.uTime.value = elapsed;

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    const sway = Math.sin(elapsed * 0.12) * 0.8;
    camera.position.set(base.x + pointer.x * 5 + sway, base.y - pointer.y * 2, base.z);
    camera.lookAt(lookAt.x + pointer.x * 2, lookAt.y, lookAt.z);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();
  if (reduceMotion) return;

  // Cap at ~30fps on phones to save battery; full rate elsewhere.
  const minStep = isSmall ? 1 / 30 : 0;
  let acc = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (document.hidden) return;
    acc += dt;
    if (acc < minStep) return;
    frame(acc);
    acc = 0;
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
