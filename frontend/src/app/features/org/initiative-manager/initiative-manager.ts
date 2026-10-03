import { Component, OnInit, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { AppConfigService } from '../../../core/config/app-config.service';
import { describeError, toApiError } from '../../../core/http/api-error';
import { CustomField, Pokestop, PokestopPatch, PokestopStatus, QuestionResult, STATUS_MEANING, STATUS_META, SurveyResults, TimelineEntry } from '../../../core/pokestop.model';
import { PokestopService } from '../../../core/pokestop.service';
import { ToastService } from '../../../core/toast.service';
import { InitiativeTimeline } from '../../../shared/initiative-timeline/initiative-timeline';

type Errors = Record<string, string>;

/** Statusy, które ustawia organizator. Odrzucenie zostaje po stronie administratora. */
const ORG_STATUSES: PokestopStatus[] = ['open', 'in_progress', 'resolved'];

/**
 * Panel prowadzenia jednej inicjatywy przez organizatora: status z komentarzem, treść i pola własne oraz wpisy na osi czasu
 * (dodawanie, edycja, usuwanie). Każda zmiana idzie do backendu od razu; walidację i uprawnienia rozstrzyga serwer.
 */
@Component({
  selector: 'app-initiative-manager',
  imports: [InitiativeTimeline],
  templateUrl: './initiative-manager.html',
  styleUrl: './initiative-manager.css',
})
export class InitiativeManager implements OnInit {
  private readonly pokestops = inject(PokestopService);
  private readonly toast = inject(ToastService);
  protected readonly limits = inject(AppConfigService).config.timeline;

  readonly stop = input.required<Pokestop>();

  protected readonly statuses = ORG_STATUSES;
  protected readonly meta = STATUS_META;
  protected readonly meaning = STATUS_MEANING;
  protected readonly busy = signal(false);

  // status
  protected readonly note = signal('');
  protected readonly statusError = signal<string | null>(null);

  // treść
  protected readonly title = linkedSignal(() => this.stop().title);
  protected readonly description = linkedSignal(() => this.stop().description);
  protected readonly contentErrors = signal<Errors>({});

  // pola własne
  protected readonly fields = linkedSignal<CustomField[]>(() => (this.stop().customFields ?? []).map((f) => ({ ...f })));
  protected readonly fieldErrors = signal<Errors>({});
  protected readonly canAddField = computed(() => this.fields().length < this.limits.maxCustomFields);

  // oś czasu
  protected readonly entries = computed(() => this.pokestops.timelines()[this.stop().id] ?? []);
  protected readonly draftTitle = signal('');
  protected readonly draftBody = signal('');
  protected readonly editing = signal<TimelineEntry | null>(null);
  protected readonly pendingDelete = signal<TimelineEntry | null>(null);
  protected readonly updateErrors = signal<Errors>({});

  // ankieta
  protected readonly hasSurvey = computed(() => (this.stop().questions?.length ?? 0) > 0);
  protected readonly results = signal<SurveyResults | null>(null);

  ngOnInit(): void {
    // Pytania ankiety są tylko w szczegółach pinezki, więc dociągamy je (cache pomija to, co już mamy).
    void this.pokestops.open(this.stop().id);
  }

  protected async loadResults(): Promise<void> {
    await this.run(async () => this.results.set(await this.pokestops.surveyResults(this.stop().id)));
  }

  /** Słupki odpowiedzi dla pytania z opcjami albo tak/nie: etykieta, liczność i udział w odpowiedziach. */
  protected bars(q: QuestionResult): { label: string; count: number; percent: number }[] {
    const labels = new Map((this.stop().questions?.find((x) => x.id === q.questionId)?.options ?? []).map((o) => [o.value, o.label]));
    const total = Math.max(1, q.answered);
    return Object.entries(q.counts ?? {}).map(([value, count]) => ({
      label: q.type === 'boolean' ? (value === 'true' ? 'Tak' : 'Nie') : (labels.get(value) ?? value),
      count,
      percent: Math.round((count / total) * 100),
    }));
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async setStatus(status: PokestopStatus): Promise<void> {
    if (status === this.stop().status) return;
    this.statusError.set(null);
    await this.run(() => this.pokestops.manage(this.stop().id, { status, ...(this.note().trim() ? { note: this.note().trim() } : {}) }), {
      done: () => this.note.set(''),
      fail: (e) => this.statusError.set(e.message),
    });
  }

  protected async saveContent(): Promise<void> {
    const patch: PokestopPatch = { title: this.title().trim(), description: this.description() };
    await this.run(() => this.pokestops.manage(this.stop().id, patch), { fail: (e) => this.contentErrors.set(e.fields), reset: () => this.contentErrors.set({}) });
  }

  protected addField(): void {
    if (this.canAddField()) this.fields.update((f) => [...f, { label: '', value: '' }]);
  }

  protected removeField(index: number): void {
    this.fields.update((f) => f.filter((_, i) => i !== index));
  }

  protected setField(index: number, part: keyof CustomField, text: string): void {
    this.fields.update((f) => f.map((item, i) => (i === index ? { ...item, [part]: text } : item)));
  }

  protected async saveFields(): Promise<void> {
    const customFields = this.fields().filter((f) => f.label.trim() || f.value.trim());
    await this.run(() => this.pokestops.manage(this.stop().id, { customFields }), { fail: (e) => this.fieldErrors.set(e.fields), reset: () => this.fieldErrors.set({}) });
  }

  protected startEdit(entry: TimelineEntry): void {
    this.pendingDelete.set(null);
    this.editing.set(entry);
    this.draftTitle.set(entry.title);
    this.draftBody.set(entry.body);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.draftTitle.set('');
    this.draftBody.set('');
    this.updateErrors.set({});
  }

  protected async saveUpdate(): Promise<void> {
    const draft = { title: this.draftTitle().trim(), body: this.draftBody().trim() };
    const editing = this.editing();
    await this.run(() => (editing ? this.pokestops.editUpdate(this.stop().id, editing.id, draft) : this.pokestops.addUpdate(this.stop().id, draft)), {
      done: () => this.cancelEdit(),
      fail: (e) => this.updateErrors.set(e.fields),
      reset: () => this.updateErrors.set({}),
    });
  }

  protected async confirmDelete(): Promise<void> {
    const entry = this.pendingDelete();
    if (!entry) return;
    await this.run(() => this.pokestops.deleteUpdate(this.stop().id, entry.id), {
      done: () => {
        this.pendingDelete.set(null);
        if (this.editing()?.id === entry.id) this.cancelEdit();
      },
    });
  }

  /** Wspólna obsługa: blokada przycisków na czas wywołania, komunikat z serwera przy błędzie. */
  private async run(action: () => Promise<unknown>, hooks: { done?: () => void; fail?: (error: ReturnType<typeof toApiError>) => void; reset?: () => void } = {}): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    hooks.reset?.();
    try {
      await action();
      hooks.done?.();
    } catch (error) {
      const e = toApiError(error);
      hooks.fail?.(e);
      this.toast.show(describeError(e), '⚠️');
    } finally {
      this.busy.set(false);
    }
  }
}
