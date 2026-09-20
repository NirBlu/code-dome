import * as THREE from 'three';

/** Procedural starfield + soft nebula sky dome (orbit / deep space). */
export function createSpaceSky(radius = 220): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(0x0a1020) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vDir;
      uniform float uTime;
      uniform vec3 uTint;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float stars(vec3 dir, float density, float size) {
        vec3 p = dir * density;
        vec3 f = floor(p);
        float n = hash(f);
        float d = length(fract(p) - 0.5);
        float tw = 0.7 + 0.3 * sin(uTime * (1.5 + n * 3.0) + n * 40.0);
        return smoothstep(size, 0.0, d) * step(0.92, n) * tw;
      }

      void main() {
        vec3 dir = normalize(vDir);
        float pole = dir.y * 0.5 + 0.5;

        // Deep space base
        vec3 col = mix(uTint, vec3(0.02, 0.04, 0.09), pole);

        // Nebula washes (soft, not photoreal)
        float n1 = hash(floor(dir * 3.0));
        float n2 = hash(floor(dir * 5.0 + 2.7));
        float neb = smoothstep(0.35, 0.85, n1) * (0.12 + 0.08 * sin(uTime * 0.05 + n1 * 6.0));
        float neb2 = smoothstep(0.4, 0.9, n2) * 0.08;
        col += vec3(0.35, 0.18, 0.55) * neb;
        col += vec3(0.12, 0.35, 0.55) * neb2 * (1.0 - pole * 0.5);

        // Milky band
        float band = exp(-pow(dir.y * 2.8, 2.0)) * 0.07;
        col += vec3(0.45, 0.5, 0.7) * band;

        // Layered stars
        col += vec3(0.85, 0.9, 1.0) * stars(dir, 80.0, 0.045);
        col += vec3(0.7, 0.85, 1.0) * stars(dir + 1.7, 140.0, 0.028) * 0.7;
        col += vec3(1.0, 0.95, 0.8) * stars(dir - 0.9, 220.0, 0.018) * 0.45;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  mesh.name = 'spaceSky';
  mesh.frustumCulled = false;
  mesh.userData.spaceMat = mat;
  return mesh;
}

/** Soft planet / drive-world body for orbit. */
export function createDrivePlanet(tint: string, radius = 6.5): THREE.Mesh {
  const color = new THREE.Color(tint);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
      uLight: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vN;
      varying vec3 vW;
      uniform vec3 uColor;
      uniform float uTime;
      uniform vec3 uLight;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec3 n = normalize(vN);
        float ndl = clamp(dot(n, uLight), 0.0, 1.0);
        float fres = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);

        // Continent-ish mottling in tangent-ish space
        float m = noise(n.xz * 4.0 + uTime * 0.02);
        m = mix(m, noise(n.xy * 6.0), 0.4);
        vec3 land = uColor * (0.55 + 0.45 * m);
        vec3 ocean = uColor * 0.35 + vec3(0.05, 0.12, 0.22);
        vec3 base = mix(ocean, land, smoothstep(0.35, 0.65, m));

        vec3 col = base * (0.25 + 0.75 * ndl);
        col += vec3(0.4, 0.7, 1.0) * fres * 0.35;
        // Atmosphere rim
        col += uColor * pow(1.0 - abs(n.y), 3.0) * 0.15;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  mesh.userData.planetMat = mat;
  return mesh;
}

/** Canvas noise/grid map for floors & walls. */
export function makeNoiseTexture(size = 128, tintHex = '#3a4a55', grid = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = tintHex;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 28;
    img.data[i] = clampByte(img.data[i] + n);
    img.data[i + 1] = clampByte(img.data[i + 1] + n);
    img.data[i + 2] = clampByte(img.data[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
  if (grid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const step = size / 8;
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function clampByte(v: number) {
  return Math.max(0, Math.min(255, v | 0));
}

/** Soft matcap-ish building body with subtle procedural grain. */
export function createToonBodyMaterial(color: number, opts?: { metalness?: number; roughness?: number }) {
  const map = makeNoiseTexture(64, '#' + new THREE.Color(color).getHexString(), false);
  map.repeat.set(2, 2);
  return new THREE.MeshStandardMaterial({
    color,
    map,
    metalness: opts?.metalness ?? 0.18,
    roughness: opts?.roughness ?? 0.55,
  });
}

/** Civic / sealed-globe glass with fresnel rim (self-contained GLSL). */
export function createGlassMaterial(color: number | THREE.Color, opacity = 0.55): THREE.ShaderMaterial {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: c },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vN;
      varying vec3 vV;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
        float pulse = 0.92 + 0.08 * sin(uTime * 0.7);
        vec3 col = uColor * (0.35 + 0.25 * max(n.y, 0.0));
        col += vec3(0.55, 0.82, 1.0) * fres * 0.75 * pulse;
        float alpha = mix(uOpacity * 0.55, min(0.92, uOpacity + 0.25), fres);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/** Dome interior soft wash (replaces flat FogExp2 alone). */
export function createDomeWash(radius: number, depth: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDepth: { value: depth },
      uColor: { value: new THREE.Color().setHSL(0.55, 0.18, Math.max(0.14, 0.38 - depth * 0.04)) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() {
        vN = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vN;
      uniform float uDepth;
      uniform vec3 uColor;
      void main() {
        float h = vN.y * 0.5 + 0.5;
        float a = (0.28 + min(0.32, uDepth * 0.05)) * (1.0 - h * 0.35);
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.6, 24, 12), mat);
  mesh.position.y = 8;
  mesh.name = 'domeWash';
  return mesh;
}

export function tickSpaceMaterials(root: THREE.Object3D, time: number) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (m && m.uniforms?.uTime) m.uniforms.uTime.value = time;
  });
}
