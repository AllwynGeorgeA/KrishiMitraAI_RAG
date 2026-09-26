// Full-screen 3D backdrop: a slow flyover of patchwork farmland at dusk.
// Pauses when the tab is hidden, renders one still frame under reduced
// motion, runs at ~30fps on phones, and renders nothing if WebGL is missing.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const HORIZON = new THREE.Color('#0b2414')

const terrainVertex = /* glsl */ `
  uniform float uTime;
  varying float vH;
  varying vec2 vW;
  varying float vDepth;
  float heightAt(vec2 p) {
    float h = sin(p.x * 0.08) * cos(p.y * 0.06) * 2.4
            + sin(p.x * 0.21 + p.y * 0.13) * 0.9
            + sin(p.y * 0.37 - p.x * 0.05) * 0.35;
    // Flat valley down the middle (behind the UI), hills at the sides.
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
`

const terrainFragment = /* glsl */ `
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
    vec3 crop = mix(vec3(0.03, 0.10, 0.05), vec3(0.07, 0.19, 0.09), h);
    crop = mix(crop, vec3(0.13, 0.15, 0.05), step(0.82, h)); // the odd ripening wheat field
    vec3 col = mix(crop * 0.7, crop * 1.25, smoothstep(-1.0, 4.0, vH));
    float rowCoord = (h > 0.5 ? local.x : local.y) * 14.0;
    float row = 1.0 - smoothstep(0.0, 0.12, abs(fract(rowCoord * 0.8) - 0.5) - 0.34);
    col += vec3(0.13, 0.77, 0.37) * row * 0.10;
    vec2 edge = min(local, 1.0 - local);
    float border = 1.0 - smoothstep(0.0, 0.018, min(edge.x, edge.y));
    col += vec3(0.29, 0.87, 0.50) * border * 0.35;
    float fog = smoothstep(18.0, 150.0, vDepth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }
`

const pollenVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.z = mod(p.z + 140.0 + uTime * 2.2, 150.0) - 140.0;
    p.y += sin(uTime * 0.6 + aSeed) * 0.6;
    p.x += cos(uTime * 0.4 + aSeed * 1.3) * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float twinkle = 0.55 + 0.45 * sin(uTime * 2.0 + aSeed * 7.0);
    vAlpha = twinkle * (1.0 - smoothstep(60.0, 140.0, -mv.z)) * smoothstep(8.0, 22.0, -mv.z);
    gl_PointSize = (0.35 + fract(aSeed) * 0.6) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const pollenFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(0.73, 0.97, 0.80, smoothstep(0.5, 0.0, d) * vAlpha * 0.8);
  }
`

const sunFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = smoothstep(0.22, 0.18, d);
    float halo = pow(max(0.0, 1.0 - d), 3.0);
    vec3 col = mix(vec3(0.30, 0.85, 0.45), vec3(0.99, 0.90, 0.54), core);
    gl_FragColor = vec4(col, core * 0.4 + halo * 0.2);
  }
`

export default function Scene3D() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const isSmall = matchMedia('(max-width: 768px), (pointer: coarse)').matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, alpha: true, powerPreference: 'low-power' })
    } catch {
      return // no WebGL: CSS gradient behind the canvas stays as the background
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1 : 1.5))
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400)
    const base = new THREE.Vector3(0, 7, 14)
    const lookAt = new THREE.Vector3(0, 3.5, -40)

    const seg = isSmall ? 90 : 200
    const terrainGeo = new THREE.PlaneGeometry(260, 200, seg, seg)
    terrainGeo.rotateX(-Math.PI / 2)
    terrainGeo.translate(0, 0, -80)
    const terrainMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFog: { value: HORIZON } },
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
    })

    const count = isSmall ? 260 : 700
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 130
      pos[i * 3 + 1] = 0.6 + Math.random() * 16
      pos[i * 3 + 2] = -140 + Math.random() * 150
      seed[i] = Math.random() * 100
    }
    const pollenGeo = new THREE.BufferGeometry()
    pollenGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pollenGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const pollenMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: window.innerHeight / 2 } },
      vertexShader: pollenVertex,
      fragmentShader: pollenFragment,
    })

    const sunGeo = new THREE.PlaneGeometry(90, 90)
    const sunMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: sunFragment,
    })
    const sun = new THREE.Mesh(sunGeo, sunMat)
    sun.position.set(-110, 22, -175)

    scene.add(sun, new THREE.Mesh(terrainGeo, terrainMat), new THREE.Points(pollenGeo, pollenMat))

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const onPointer = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5
      pointer.ty = e.clientY / window.innerHeight - 0.5
    }

    let elapsed = 0
    const frame = (dt: number) => {
      elapsed += dt
      terrainMat.uniforms.uTime.value = elapsed
      pollenMat.uniforms.uTime.value = elapsed
      pointer.x += (pointer.tx - pointer.x) * 0.04
      pointer.y += (pointer.ty - pointer.y) * 0.04
      const sway = Math.sin(elapsed * 0.12) * 0.8
      camera.position.set(base.x + pointer.x * 5 + sway, base.y - pointer.y * 2, base.z)
      camera.lookAt(lookAt.x + pointer.x * 2, lookAt.y, lookAt.z)
      renderer.render(scene, camera)
    }

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      pollenMat.uniforms.uScale.value = h / 2
      if (reduceMotion) frame(0)
    }
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    resize()

    if (!reduceMotion) {
      const clock = new THREE.Clock()
      const minStep = isSmall ? 1 / 30 : 0
      let acc = 0
      renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 0.1)
        if (document.hidden) return
        acc += dt
        if (acc < minStep) return
        frame(acc)
        acc = 0
      })
    }

    return () => {
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      ;[terrainGeo, pollenGeo, sunGeo, terrainMat, pollenMat, sunMat].forEach((o) => o.dispose())
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen"
      style={{ background: 'linear-gradient(180deg, #040b07 0%, #06100a 38%, #0b2414 62%, #06100a 100%)' }}
    />
  )
}
