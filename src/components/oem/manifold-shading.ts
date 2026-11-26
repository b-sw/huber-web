// The look of the manifold: a photo studio to reflect, and surface wear that no primitive has.
import * as THREE from 'three';

export interface Surface {
  // Feature size of the wear in mm. Along the part axis the wear runs `stretch` times longer, like drawn or rolled stock.
  size: number;
  stretch: number;
  rough: number;
  tone: number;
  // Height of the waviness in mm.
  bump: number;
  // How much more opaque the grazing edges are than the faces.
  rim?: number;
}

const NOISE = /* glsl */ `
varying vec3 vSurface;
uniform vec3 uSurfaceSize;
uniform vec3 uSurfaceAmount;
uniform float uSurfaceRim;
float surfaceHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float surfaceNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(surfaceHash(i), surfaceHash(i + vec3(1, 0, 0)), f.x), mix(surfaceHash(i + vec3(0, 1, 0)), surfaceHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(surfaceHash(i + vec3(0, 0, 1)), surfaceHash(i + vec3(1, 0, 1)), f.x), mix(surfaceHash(i + vec3(0, 1, 1)), surfaceHash(i + 1.0), f.x), f.y),
    f.z);
}
`;

export function surfaced<T extends THREE.MeshStandardMaterial>(material: T, surface: Surface): T {
  if (surface.rim) material.defines = { ...material.defines, SURFACE_RIM: '' };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSurfaceSize = { value: new THREE.Vector3(surface.size, surface.size * surface.stretch, surface.size) };
    shader.uniforms.uSurfaceAmount = { value: new THREE.Vector3(surface.rough, surface.tone, surface.bump) };
    shader.uniforms.uSurfaceRim = { value: surface.rim ?? 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurface;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 surfaceAt = vSurface / uSurfaceSize;
        float surfaceGrain = 0.5 * surfaceNoise(surfaceAt) + 0.3 * surfaceNoise(surfaceAt * 2.03 + 1.7) + 0.2 * surfaceNoise(surfaceAt * 4.01 + 3.1);
        float surfaceTone = surfaceNoise(surfaceAt * 0.31 + 7.0);
        diffuseColor.rgb *= 1.0 + (surfaceTone - 0.5) * 2.0 * uSurfaceAmount.y;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (surfaceGrain - 0.5) * 2.0 * uSurfaceAmount.x, 0.03, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          float height = surfaceGrain * uSurfaceAmount.z;
          vec3 dx = dFdx(-vViewPosition);
          vec3 dy = dFdy(-vViewPosition);
          vec3 r1 = cross(dy, normal);
          vec3 r2 = cross(normal, dx);
          float det = dot(dx, r1) * faceDirection;
          vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
          normal = normalize(abs(det) * normal - gradient);
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `#ifdef SURFACE_RIM
        float surfaceFacing = abs(dot(normal, normalize(vViewPosition)));
        diffuseColor.a = clamp(diffuseColor.a * (1.0 + uSurfaceRim * pow(1.0 - surfaceFacing, 2.0)), 0.0, 1.0);
        #endif
        #include <opaque_fragment>`,
      );
  };
  return material;
}

// A dark tent with softboxes, as in a product shoot. Metal reads as metal only when it has something to reflect.
export function studio(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color().setRGB(0.22, 0.2, 0.18);

  const panel = new THREE.PlaneGeometry(1, 1);
  const light = (intensity: number, [x, y, z]: number[], [w, h]: number[], tint = [1, 1, 1]) => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    material.color.setRGB(tint[0] * intensity, tint[1] * intensity, tint[2] * intensity);
    const mesh = new THREE.Mesh(panel, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 1);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  // The camera looks from the front left (YAW in the scene). A beam along x mirrors that to the front right.
  light(3.2, [4, 2.5, 9], [9, 4.5]);
  light(2, [-7, 2, 7], [6, 6]);
  light(2.2, [0, 10, -1], [16, 2.2]);
  light(2.4, [-10, 1, 1], [1.6, 12]);
  light(1.4, [9, 1.5, -5], [2, 10]);
  light(0.35, [0, 3, -10], [14, 8], [1, 0.95, 0.88]);
  light(0.06, [0, -7, 0], [40, 40], [1, 0.85, 0.65]);

  return scene;
}

// The studio, prefiltered for reflections. The generator draws with each shader right after it compiles it, so the
// page waits for every compile. A dry run first compiles each shader instead of drawing, and the GPU compiles them in
// the background. The real run then finds them ready.
export async function studioEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  const scene = studio();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const bake = () => pmrem.fromScene(scene, 0.02, 0.1, 100, { size: 512 });
  const compiled: Promise<unknown>[] = [];
  const render = renderer.render;
  renderer.render = (object, camera) => void compiled.push(renderer.compileAsync(object, camera));
  try {
    bake().dispose();
  } finally {
    renderer.render = render;
  }
  await Promise.all(compiled);
  const { texture } = bake();
  pmrem.dispose();
  return texture;
}
