import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { CharacterId, Pokestop } from '../../../core/pokestop.model';
import { createCharacter } from './character-factory';

interface Placed {
  object: THREE.Object3D;
  mercator: maplibregl.MercatorCoordinate;
  phase: number;
}

/** Własna warstwa MapLibre rysująca postacie 3D (three.js) w miejscach pokestopów. */
export class CharactersLayer implements maplibregl.CustomLayerInterface {
  readonly id = 'characters-3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map?: maplibregl.Map;
  private renderer?: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly placed = new Map<number, Placed>();
  private readonly cache = new Map<CharacterId, Promise<THREE.Object3D>>();

  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-1, 2, 1.5);
    this.scene.add(sun);
  }

  onRemove(): void {
    this.renderer?.dispose();
  }

  /** Dopasowuje postacie do listy pokestopów: dodaje nowe, usuwa brakujące. */
  async setStops(stops: Pokestop[]): Promise<void> {
    const ids = new Set(stops.map((s) => s.id));
    for (const [id, placed] of this.placed) {
      if (ids.has(id)) continue;
      this.scene.remove(placed.object);
      this.placed.delete(id);
    }
    await Promise.all(
      stops
        .filter((s) => !this.placed.has(s.id))
        .map(async (stop) => {
          if (!this.cache.has(stop.character)) this.cache.set(stop.character, createCharacter(stop.character));
          const template = await this.cache.get(stop.character)!;
          const object = template.clone(true);
          object.visible = false;
          this.scene.add(object);
          this.placed.set(stop.id, {
            object,
            mercator: maplibregl.MercatorCoordinate.fromLngLat([stop.lng, stop.lat], 0),
            phase: stop.id,
          });
        }),
    );
    this.map?.triggerRepaint();
  }

  render(_gl: WebGL2RenderingContext, options: maplibregl.CustomRenderMethodInput): void {
    if (!this.renderer) return;
    const main = new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix as unknown as number[]);
    const t = performance.now() / 1000;

    this.renderer.resetState();
    for (const p of this.placed.values()) {
      p.object.rotation.y = t * 0.8 + p.phase;
      const s = p.mercator.meterInMercatorCoordinateUnits();
      const model = new THREE.Matrix4()
        .makeTranslation(p.mercator.x, p.mercator.y, p.mercator.z)
        .scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      this.camera.projectionMatrix = main.clone().multiply(model);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

      p.object.visible = true;
      this.renderer.render(this.scene, this.camera);
      p.object.visible = false;
    }
    this.map?.triggerRepaint(); // ciągła animacja obrotu
  }
}
