import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { CharacterId, Pokestop, isTrustedType } from '../../../core/pokestop.model';
import { createCharacter, createEventBase, createTrustedMarker } from './character-factory';
import { addLights } from './lighting';

/** Klucz wspólnego modelu inicjatyw zaufanych podmiotów w pamięci podręcznej (nie jest kodem postaci). */
const TRUSTED_KEY = '!trusted';

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
  private readonly placed = new Map<string, Placed>();
  private readonly cache = new Map<CharacterId, Promise<THREE.Object3D>>();

  /** @param modelPathOf ścieżka modelu 3D dla kodu postaci (ze słownika postaci). */
  constructor(private readonly modelPathOf: (character: CharacterId) => string | null) {}

  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    addLights(this.scene);
  }

  onRemove(): void {
    this.renderer?.dispose();
  }

  /** Dopasowuje postacie do listy pokestopów: dodaje nowe, usuwa brakujące. */
  async setStops(stops: Pokestop[]): Promise<void> {
    await this.sync(
      's',
      stops.map((stop) => {
        // Inicjatywa zaufanego podmiotu to wykrzyknik, a nie postać: gatunek nagrody za ankietę jest tajemnicą do jej wypełnienia.
        const trusted = isTrustedType(stop.type);
        return {
          id: stop.id, lat: stop.lat, lng: stop.lng, key: trusted ? TRUSTED_KEY : stop.character,
          load: () => (trusted ? Promise.resolve(createTrustedMarker()) : createCharacter(this.modelPathOf(stop.character), stop.character)),
        };
      }),
    );
  }

  /**
   * Dopasowuje punkty wydarzeń: przy każdym kręci się rzadki pokemon, którego dostanie uczestnik (w odróżnieniu od inicjatyw
   * zaufanych podmiotów, tu nagroda jest jawna), na podstawie odróżniającej punkt wydarzenia.
   */
  async setEvents(events: { id: number; lat: number; lng: number; rewardCharacter: CharacterId }[]): Promise<void> {
    await this.sync(
      'e',
      events.map((event) => ({
        id: event.id, lat: event.lat, lng: event.lng, key: `event:${event.rewardCharacter}`,
        load: async () => {
          const group = new THREE.Group();
          group.add(await createCharacter(this.modelPathOf(event.rewardCharacter), event.rewardCharacter), createEventBase());
          return group;
        },
      })),
    );
  }

  /** Wspólna synchronizacja jednego rodzaju obiektów (`s` pinezki, `e` wydarzenia): usuwa brakujące, dodaje nowe. */
  private async sync(kind: 's' | 'e', items: { id: number; lat: number; lng: number; key: string; load: () => Promise<THREE.Object3D> }[]): Promise<void> {
    const wanted = new Set(items.map((i) => `${kind}:${i.id}`));
    for (const [key, placed] of this.placed) {
      if (!key.startsWith(`${kind}:`) || wanted.has(key)) continue;
      this.scene.remove(placed.object);
      this.placed.delete(key);
    }
    await Promise.all(
      items
        .filter((i) => !this.placed.has(`${kind}:${i.id}`))
        .map(async (item) => {
          if (!this.cache.has(item.key)) this.cache.set(item.key, item.load());
          const template = await this.cache.get(item.key)!;
          const placedKey = `${kind}:${item.id}`;
          if (this.placed.has(placedKey)) return; // w międzyczasie dodała go inna synchronizacja
          const object = template.clone(true);
          object.visible = false;
          this.scene.add(object);
          this.placed.set(placedKey, { object, mercator: maplibregl.MercatorCoordinate.fromLngLat([item.lng, item.lat], 0), phase: item.id });
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
      this.draw(main, p.object, p.mercator);
    }
    this.map?.triggerRepaint(); // ciągła animacja obrotu
  }

  private draw(main: THREE.Matrix4, object: THREE.Object3D, mercator: maplibregl.MercatorCoordinate): void {
    const s = mercator.meterInMercatorCoordinateUnits();
    const model = new THREE.Matrix4()
      .makeTranslation(mercator.x, mercator.y, mercator.z)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    this.camera.projectionMatrix = main.clone().multiply(model);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    object.visible = true;
    this.renderer!.render(this.scene, this.camera);
    object.visible = false;
  }
}
