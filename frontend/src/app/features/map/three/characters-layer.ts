import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { CharacterId, Pokestop, isTrustedType } from '../../../core/pokestop.model';
import { createCharacter, createTrustedMarker } from './character-factory';

/** Klucz wspólnego modelu inicjatyw zaufanych podmiotów w pamięci podręcznej (nie jest kodem postaci). */
const TRUSTED_KEY = '!trusted';

interface Placed {
  object: THREE.Object3D;
  mercator: maplibregl.MercatorCoordinate;
  phase: number;
}

/** Model gracza jest mniejszy od postaci na pinezkach, żeby ich nie zasłaniał. */
const PLAYER_SCALE = 0.6;

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
  /** Model gracza (jego Spryciak-towarzysz); nie obraca się w kółko, tylko lekko "oddycha". */
  private player?: { object: THREE.Object3D; mercator: maplibregl.MercatorCoordinate; modelPath: string | null };
  private readonly playerTemplates = new Map<string | null, Promise<THREE.Object3D>>();

  /** @param modelPathOf ścieżka modelu 3D dla kodu postaci (ze słownika postaci). */
  constructor(private readonly modelPathOf: (character: CharacterId) => string | null) {}

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
          // Inicjatywa zaufanego podmiotu to wykrzyknik, a nie postać: gatunek nagrody za ankietę jest tajemnicą do jej wypełnienia.
          const key = isTrustedType(stop.type) ? TRUSTED_KEY : stop.character;
          if (!this.cache.has(key)) this.cache.set(key, key === TRUSTED_KEY ? Promise.resolve(createTrustedMarker()) : createCharacter(this.modelPathOf(stop.character)));
          const template = await this.cache.get(key)!;
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

  /** Ustawia (albo przesuwa) model gracza. Zmiana modelu podmienia obiekt. */
  async setPlayer(lngLat: [number, number], modelPath: string | null): Promise<void> {
    const mercator = maplibregl.MercatorCoordinate.fromLngLat(lngLat, 0);
    if (this.player && this.player.modelPath === modelPath) {
      this.player.mercator = mercator;
      this.map?.triggerRepaint();
      return;
    }
    if (!this.playerTemplates.has(modelPath)) this.playerTemplates.set(modelPath, createCharacter(modelPath));
    const object = (await this.playerTemplates.get(modelPath)!).clone(true);
    object.scale.setScalar(PLAYER_SCALE);
    object.visible = false;
    if (this.player) this.scene.remove(this.player.object);
    this.scene.add(object);
    this.player = { object, mercator, modelPath };
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
    if (this.player) {
      this.player.object.scale.setScalar(PLAYER_SCALE * (1 + Math.sin(t * 2.4) * 0.03));
      this.draw(main, this.player.object, this.player.mercator);
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
