import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AppConfigService } from '../../core/config/app-config.service';
import { CHARACTERS, CHARACTER_IDS } from '../../core/pokestop.model';
import { FieldDef, FieldValues, Scenario } from '../../core/scenario.model';
import { initialValues, isVisible, parseTags, validate } from '../../core/scenario.utils';

/** Uniwersalny formularz renderowany z definicji scenariusza (pola, sekcje, warunki widoczności). */
@Component({
  selector: 'app-scenario-form',
  templateUrl: './scenario-form.html',
  styleUrl: './scenario-form.css',
})
export class ScenarioForm {
  private readonly upload = inject(AppConfigService).config.upload;
  protected readonly maxPhotos = this.upload.maxPhotos;
  readonly scenario = input.required<Scenario>();
  readonly submitLabel = input('Dodaj zgłoszenie');
  readonly submitted = output<FieldValues>();
  readonly cancelled = output<void>();

  protected readonly values = linkedSignal<FieldValues>(() => initialValues(this.scenario()));
  protected readonly attempted = signal(false);
  protected readonly photoError = signal<string | null>(null);
  protected readonly errors = computed(() => validate(this.scenario(), this.values()));

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly characters = CHARACTER_IDS.map((id) => ({ id, ...CHARACTERS[id] }));

  protected visible(field: FieldDef): boolean {
    return isVisible(field, this.values());
  }

  protected str(key: string): string {
    const v = this.values()[key];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  }

  protected list(key: string): string[] {
    const v = this.values()[key];
    return Array.isArray(v) ? (v as string[]) : [];
  }

  protected set(key: string, value: unknown): void {
    this.values.update((v) => ({ ...v, [key]: value }));
  }

  protected onText(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement).value);
  }

  protected onCheck(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement).checked);
  }

  protected onTags(key: string, event: Event): void {
    this.set(key, parseTags((event.target as HTMLInputElement).value));
  }

  protected toggleMulti(key: string, option: string): void {
    const current = this.list(key);
    this.set(key, current.includes(option) ? current.filter((o) => o !== option) : [...current, option]);
  }

  protected async onPhotos(key: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.photoError.set(null);
    const room = this.upload.maxPhotos - this.list(key).length;
    const added: string[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > this.upload.maxPhotoBytes) {
        this.photoError.set(`Zdjęcie jest za duże (maks. ${Math.round(this.upload.maxPhotoBytes / 1024 / 1024)} MB)`);
        continue;
      }
      added.push(await readAsDataUrl(file));
    }
    if (files.length > room) this.photoError.set(`Maksymalnie ${this.upload.maxPhotos} zdjęcia`);
    this.set(key, [...this.list(key), ...added]);
  }

  protected removePhoto(key: string, index: number): void {
    this.set(key, this.list(key).filter((_, i) => i !== index));
  }

  protected submit(): void {
    this.attempted.set(true);
    if (Object.keys(this.errors()).length === 0) this.submitted.emit(this.values());
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
