import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterId } from '../../../core/pokestop.model';

/** Wysokość postaci na mapie w metrach (przesadnie duża, żeby były widoczne z lotu ptaka). */
const CHARACTER_HEIGHT_M = 36;

const MODEL_FILES: Partial<Record<CharacterId, string>> = {
  tree: 'models/kenney-mini-forest/tree.glb',
  train: 'models/kenney-train-kit/train-electric-city-a.glb',
  lamp: 'models/kenney-city-kit-roads/light-curved.glb',
};

const gltfLoader = new GLTFLoader();

/** Zwraca postać z podstawą na y=0, wyśrodkowaną w poziomie, o wysokości CHARACTER_HEIGHT_M. */
export async function createCharacter(id: CharacterId): Promise<THREE.Object3D> {
  const file = MODEL_FILES[id];
  const raw = file ? (await gltfLoader.loadAsync(file)).scene : id === 'cyclist' ? buildCyclist() : buildBinCreature();
  return normalize(raw);
}

function normalize(object: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // Pociąg jest długi, więc skalujemy po największym wymiarze, a nie po wysokości.
  const scale = CHARACTER_HEIGHT_M / Math.max(size.y, size.x * 0.5, size.z * 0.5);
  object.position.set(-center.x, -box.min.y, -center.z);
  const holder = new THREE.Group();
  holder.add(object);
  holder.scale.setScalar(scale);
  const wrapper = new THREE.Group();
  wrapper.add(holder);
  return wrapper;
}

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });

/** Stworek Kosz: low-poly kosz z oczami i rączkami (własna postać, bez zewnętrznych assetów). */
function buildBinCreature(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.3, 8), mat(0x2f9e6e));
  body.position.y = 0.85;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 8), mat(0x1f6f4d));
  lid.position.y = 1.58;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), mat(0x1f6f4d));
  handle.position.y = 1.72;
  g.add(body, lid, handle);
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), mat(0xffffff));
    eye.position.set(x, 1.05, 0.46);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat(0x111111));
    pupil.position.set(x, 1.05, 0.58);
    g.add(eye, pupil);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 5), mat(0x2f9e6e));
    arm.position.set(x * 3.2, 0.85, 0);
    arm.rotation.z = x > 0 ? -0.5 : 0.5;
    g.add(arm);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.4), mat(0x1f6f4d));
    foot.position.set(x * 1.3, 0.08, 0.05);
    g.add(foot);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.05), mat(0x111111));
  mouth.position.set(0, 0.7, 0.5);
  g.add(mouth);
  return g;
}

/** Rowerzysta: low-poly rower z zawodnikiem w kasku (własna postać). */
function buildCyclist(): THREE.Group {
  const g = new THREE.Group();
  const wheel = (x: number) => {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 5, 12), mat(0x222222));
    w.position.set(x, 0.5, 0);
    return w;
  };
  g.add(wheel(-0.75), wheel(0.75));
  const bar = (from: [number, number], to: [number, number], color = 0xef4444) => {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, Math.hypot(dx, dy), 5), mat(color));
    m.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0);
    m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    return m;
  };
  g.add(bar([-0.75, 0.5], [-0.1, 0.55]), bar([-0.1, 0.55], [0.55, 0.95]), bar([-0.1, 0.55], [-0.2, 1.0]), bar([0.55, 0.95], [0.75, 0.5]), bar([-0.2, 1.0], [0.55, 0.95]));
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 3, 6), mat(0x3b82f6));
  torso.position.set(0.05, 1.55, 0);
  torso.rotation.z = -0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 6), mat(0xf5c9a0));
  head.position.set(0.4, 2.05, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xfacc15));
  helmet.position.set(0.4, 2.1, 0);
  g.add(torso, head, helmet, bar([0.0, 1.35], [-0.1, 0.65], 0x1e3a8a), bar([0.3, 1.7], [0.6, 1.0], 0x3b82f6));
  return g;
}
