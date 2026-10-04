import * as THREE from 'three';

/** Światło wspólne dla obracających się modeli 3D (mapa i miniatury Spryciaków): słabsze, żeby modele nie wyglądały na prześwietlone. */
const AMBIENT_INTENSITY = 0.9;
const SUN_INTENSITY = 1.2;

/** Dodaje do sceny światło otoczenia i słońce o wspólnych ustawieniach. */
export function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY));
  const sun = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
  sun.position.set(-1, 2, 1.5);
  scene.add(sun);
}
