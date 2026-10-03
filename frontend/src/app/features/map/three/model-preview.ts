import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { createCharacter } from './character-factory';

/** Rozmiar bufora renderowania jednej miniatury (px, przed devicePixelRatio). */
const RENDER_PX = 220;
const FRAME_MS = 1000 / 30;
/** Obrót wokół osi pionowej (radiany na sekundę). */
const SPIN = 0.9;

interface Preview {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  object: THREE.Object3D;
  /** Odległość i wysokość kamery dobrane do rozmiaru modelu (cały model mieści się w kadrze w każdej fazie obrotu). */
  distance: number;
  targetY: number;
  phase: number;
  visible: boolean;
}

/**
 * Miniatury 3D Spryciaków w listach (galeria, profil). Jeden wspólny renderer WebGL rysuje po kolei każdy widoczny
 * model i kopiuje obraz na płótno 2D danej karty: przeglądarki pozwalają na kilkanaście kontekstów WebGL naraz,
 * a kart może być kilkadziesiąt. Niewidoczne karty (IntersectionObserver) nie są rysowane.
 */
@Injectable({ providedIn: 'root' })
export class ModelPreviewService {
  private renderer?: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 5000);
  private readonly previews = new Set<Preview>();
  private readonly templates = new Map<string | null, Promise<THREE.Object3D>>();
  private observer?: IntersectionObserver;
  private frame?: number;
  private readonly still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Podpina miniaturę modelu do płótna. Zwraca funkcję odpinającą. Rzuca błąd, gdy przeglądarka nie ma WebGL
   * (wtedy komponent pokazuje emoji).
   */
  async attach(canvas: HTMLCanvasElement, modelPath: string | null, options: { silhouette?: boolean; phase?: number } = {}): Promise<() => void> {
    this.ensureRenderer();
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Brak kontekstu 2D');
    const object = (await this.template(modelPath)).clone(true);
    if (options.silhouette) paintSilhouette(object, cssColor('--color-plum'));
    const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
    const preview: Preview = {
      canvas, context, object, phase: options.phase ?? 0, visible: true,
      distance: (sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.05,
      targetY: sphere.center.y,
    };
    this.previews.add(preview);
    this.observe(preview);
    this.loop();
    return () => {
      this.previews.delete(preview);
      this.observer?.unobserve(canvas);
      if (!this.previews.size && this.frame !== undefined) {
        cancelAnimationFrame(this.frame);
        this.frame = undefined;
      }
    };
  }

  private template(modelPath: string | null): Promise<THREE.Object3D> {
    if (!this.templates.has(modelPath)) this.templates.set(modelPath, createCharacter(modelPath));
    return this.templates.get(modelPath)!;
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(RENDER_PX, RENDER_PX, false);
    renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-1, 2, 1.5);
    this.scene.add(sun);
    this.renderer = renderer;
  }

  private observe(preview: Preview): void {
    if (typeof IntersectionObserver !== 'function') return;
    this.observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const p = [...this.previews].find((x) => x.canvas === entry.target);
        if (p) p.visible = entry.isIntersecting;
      }
    });
    this.observer.observe(preview.canvas);
  }

  private loop(): void {
    if (this.frame !== undefined) return;
    let last = 0;
    const tick = (now: number) => {
      // Do ~30 klatek na sekundę: przy kilkudziesięciu miniaturach to wystarcza i oszczędza baterię telefonu.
      if (this.still || now - last >= FRAME_MS) {
        last = now;
        this.draw(this.still ? 0.6 : now / 1000);
      }
      this.frame = this.still ? undefined : requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private draw(t: number): void {
    const renderer = this.renderer!;
    const source = renderer.domElement;
    for (const p of this.previews) {
      if (!p.visible) continue;
      p.object.rotation.y = t * SPIN + p.phase;
      this.camera.position.set(0, p.targetY + p.distance * 0.25, p.distance);
      this.camera.lookAt(0, p.targetY, 0);
      this.scene.add(p.object);
      renderer.render(this.scene, this.camera);
      this.scene.remove(p.object);
      const { width, height } = p.canvas;
      p.context.clearRect(0, 0, width, height);
      p.context.drawImage(source, 0, 0, width, height);
    }
  }
}

/** Nieodkryty gatunek w atlasie: sama sylwetka modelu w kolorze tekstu. */
function paintSilhouette(object: THREE.Object3D, color: string): void {
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  object.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) (node as THREE.Mesh).material = material;
  });
}

function cssColor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || 'black';
}
