import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Wysokość postaci na mapie w metrach (przesadnie duża, żeby były widoczne z lotu ptaka). */
const CHARACTER_HEIGHT_M = 36;

const gltfLoader = new GLTFLoader();

/**
 * Zwraca postać z podstawą na y=0, wyśrodkowaną w poziomie, o wysokości CHARACTER_HEIGHT_M.
 * `modelPath` (glTF, względem public/) pochodzi ze słownika postaci; bez modelu albo gdy plik się nie wczyta, rysujemy postać zastępczą.
 */
export async function createCharacter(modelPath: string | null): Promise<THREE.Object3D> {
  if (!modelPath) return normalize(buildPlaceholder());
  try {
    return normalize((await gltfLoader.loadAsync(modelPath)).scene);
  } catch (error) {
    console.warn(`Nie udało się wczytać modelu postaci "${modelPath}", używam zastępczej`, error);
    return normalize(buildPlaceholder());
  }
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

/** Postać zastępcza dla gatunku bez modelu 3D: low-poly stworek z oczami i rączkami (bez zewnętrznych assetów). */
function buildPlaceholder(): THREE.Group {
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
