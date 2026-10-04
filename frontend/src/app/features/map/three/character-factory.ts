import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Wysokość postaci na mapie w metrach (przesadnie duża, żeby były widoczne z lotu ptaka). */
const CHARACTER_HEIGHT_M = 36;

const gltfLoader = new GLTFLoader();

/**
 * Zwraca postać z podstawą na y=0, wyśrodkowaną w poziomie, o wysokości CHARACTER_HEIGHT_M.
 * `modelPath` (glTF, względem public/) pochodzi ze słownika postaci; bez modelu albo gdy plik się nie wczyta, rysujemy postać zastępczą.
 */
export async function createCharacter(modelPath: string | null, code?: string): Promise<THREE.Object3D> {
  if (!modelPath) return normalize(buildPlaceholder(code));
  try {
    return normalize((await gltfLoader.loadAsync(modelPath)).scene);
  } catch (error) {
    console.warn(`Nie udało się wczytać modelu postaci "${modelPath}", używam zastępczej`, error);
    return normalize(buildPlaceholder(code));
  }
}

/** Barwy postaci zastępczej: tokeny palety, wybierane po kodzie gatunku, żeby rzadkie gatunki bez modelu różniły się od siebie. */
const PLACEHOLDER_TOKENS = ['--color-pink', '--color-indigo', '--color-lavender', '--color-plum'];

/** Indeks barwy (0 do 3) dla kodu gatunku; ten sam kod zawsze daje tę samą barwę. */
export function placeholderTintIndex(code: string): number {
  let hash = 0;
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % PLACEHOLDER_TOKENS.length;
}

function placeholderColors(code?: string): { body: number; dark: number } {
  if (!code) return { body: 0x2f9e6e, dark: 0x1f6f4d };
  const token = getComputedStyle(document.documentElement).getPropertyValue(PLACEHOLDER_TOKENS[placeholderTintIndex(code)]).trim();
  const body = new THREE.Color(token || '#7371fc');
  return { body: body.getHex(), dark: body.clone().multiplyScalar(0.65).getHex() };
}

/** Kolor z tokenu palety (styles.css): materiały three.js wymagają konkretnej wartości, nie zmiennej CSS. */
const token = (name: string, fallback: string): THREE.Color =>
  new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);

/**
 * Wykrzyknik: wspólny model inicjatyw zaufanych podmiotów (organizacje, urzędy). Celowo generyczny, żeby z mapy nie dało się
 * odgadnąć, jaki Spryciak czeka za ankietą. Zbudowany z prymitywów (bez zewnętrznych assetów), w kolorach palety.
 */
export function createTrustedMarker(): THREE.Object3D {
  const body = new THREE.MeshStandardMaterial({ color: token('--color-pink', '#ea638c'), flatShading: true, roughness: 0.6 });
  const dot = new THREE.MeshStandardMaterial({ color: token('--color-plum', '#4f345a'), flatShading: true, roughness: 0.6 });
  const group = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.36, 2.5, 6), body);
  bar.position.y = 2.15;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 6, 4), body);
  cap.position.y = 3.4;
  const point = new THREE.Mesh(new THREE.SphereGeometry(0.46, 6, 5), dot);
  point.position.y = 0.46;
  group.add(bar, cap, point);
  return normalize(group);
}

/**
 * Podstawa pod modelem wydarzenia: płaski, jasny dysk, który odróżnia punkt wydarzenia od zwykłych pinezek
 * (rzadki pokemon stoi na scenie). Wymiary w metrach, jak postać.
 */
export function createEventBase(): THREE.Object3D {
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15, 0.9, 28),
    new THREE.MeshStandardMaterial({ color: token('--color-lavender', '#cdc1ff'), flatShading: true, roughness: 0.7 }),
  );
  disc.position.y = 0.45;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(15, 0.9, 6, 36),
    new THREE.MeshStandardMaterial({ color: token('--color-pink', '#ea638c'), flatShading: true, roughness: 0.6 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.9;
  const group = new THREE.Group();
  group.add(disc, rim);
  return group;
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
function buildPlaceholder(code?: string): THREE.Group {
  const { body: bodyColor, dark } = placeholderColors(code);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.3, 8), mat(bodyColor));
  body.position.y = 0.85;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 8), mat(dark));
  lid.position.y = 1.58;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), mat(dark));
  handle.position.y = 1.72;
  g.add(body, lid, handle);
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), mat(0xffffff));
    eye.position.set(x, 1.05, 0.46);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat(0x111111));
    pupil.position.set(x, 1.05, 0.58);
    g.add(eye, pupil);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 5), mat(bodyColor));
    arm.position.set(x * 3.2, 0.85, 0);
    arm.rotation.z = x > 0 ? -0.5 : 0.5;
    g.add(arm);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.4), mat(dark));
    foot.position.set(x * 1.3, 0.08, 0.05);
    g.add(foot);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.05), mat(0x111111));
  mouth.position.set(0, 0.7, 0.5);
  g.add(mouth);
  return g;
}
