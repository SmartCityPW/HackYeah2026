import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { CatalogService } from '../../core/catalog/catalog.service';
import { ModelPreviewService } from '../../features/map/three/model-preview';

/**
 * Obracający się model 3D Spryciaka (wokół własnej osi pionowej). `silhouette` pokazuje sam zarys (nieodkryty gatunek).
 * Bez WebGL (np. w testach) zostaje emoji postaci.
 */
@Component({
  selector: 'app-spryciak-model',
  styles: `
    :host { display: grid; place-items: center; aspect-ratio: 1; }
    canvas { width: 100%; height: 100%; }
    .fallback { font-size: 2.4em; line-height: 1; }
  `,
  template: `
    @if (fallback()) {
      <span class="fallback" aria-hidden="true">{{ silhouette() ? '?' : species().emoji }}</span>
    } @else {
      <canvas #canvas width="220" height="220" role="img" [attr.aria-label]="silhouette() ? 'Nieodkryty Spryciak' : species().label"></canvas>
    }
  `,
})
export class SpryciakModel {
  readonly character = input.required<string>();
  readonly silhouette = input(false);
  /** Przesunięcie fazy obrotu, żeby sąsiednie modele nie kręciły się identycznie. */
  readonly phase = input(0);

  private readonly catalog = inject(CatalogService);
  private readonly previews = inject(ModelPreviewService);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly species = computed(() => this.catalog.character(this.character()));
  protected readonly fallback = signal(false);

  constructor() {
    let detach: (() => void) | undefined;
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      detach?.();
    });
    afterNextRender(async () => {
      const canvas = this.canvas()?.nativeElement;
      if (!canvas) return;
      try {
        const off = await this.previews.attach(canvas, this.species().modelPath, { silhouette: this.silhouette(), phase: this.phase(), code: this.character() });
        if (destroyed) off();
        else detach = off;
      } catch {
        this.fallback.set(true);
      }
    });
  }
}
