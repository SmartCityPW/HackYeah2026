import { Component, computed, inject, model, signal } from '@angular/core';
import { AppConfigService } from '../../core/config/app-config.service';
import { NewQuestion, QuestionOption, QuestionType } from '../../core/pokestop.model';

interface Draft {
  uid: number;
  label: string;
  type: QuestionType;
  required: boolean;
  /** Opcje, jedna w wierszu (pytania z wyborem). */
  options: string;
}

const TYPES: { type: QuestionType; label: string; hasOptions?: boolean }[] = [
  { type: 'boolean', label: 'Tak / nie' },
  { type: 'choice', label: 'Wybór jednej odpowiedzi', hasOptions: true },
  { type: 'multiselect', label: 'Wybór kilku odpowiedzi', hasOptions: true },
  { type: 'rating', label: 'Ocena 1-5' },
  { type: 'number', label: 'Liczba' },
  { type: 'text', label: 'Krótka odpowiedź' },
  { type: 'textarea', label: 'Długa odpowiedź' },
];

/** Kształt pytania w kreatorze; wartości opcji i klucze pytań nadajemy automatycznie (organizacja ich nie widzi). */
const optionsOf = (text: string): QuestionOption[] =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((label, i) => ({ value: `o${i + 1}`, label }));

/**
 * Kreator pytań ankiety przy inicjatywie organizacji. Wynik (`questions`) zawiera tylko kompletne pytania; `valid` mówi,
 * czy wszystkie rozpoczęte pytania są kompletne (pytanie bez treści nie liczy się jako rozpoczęte, ale z opcjami bez treści tak).
 */
@Component({
  selector: 'app-question-builder',
  templateUrl: './question-builder.html',
  styleUrl: './question-builder.css',
})
export class QuestionBuilder {
  protected readonly limits = inject(AppConfigService).config.survey;
  readonly questions = model<NewQuestion[]>([]);
  readonly valid = model(true);

  protected readonly types = TYPES;
  private nextUid = 1;
  protected readonly drafts = signal<Draft[]>([]);
  protected readonly canAdd = computed(() => this.drafts().length < this.limits.maxQuestions);
  /** Komunikat o niekompletnym pytaniu (numer od 1) albo null. */
  protected readonly problems = computed(() => this.drafts().map((d) => this.problem(d)));

  protected hasOptions(type: QuestionType): boolean {
    return TYPES.find((t) => t.type === type)?.hasOptions ?? false;
  }

  protected add(): void {
    if (!this.canAdd()) return;
    this.drafts.update((d) => [...d, { uid: this.nextUid++, label: '', type: 'boolean', required: true, options: '' }]);
    this.publish();
  }

  protected remove(uid: number): void {
    this.drafts.update((d) => d.filter((x) => x.uid !== uid));
    this.publish();
  }

  protected change(uid: number, patch: Partial<Draft>): void {
    this.drafts.update((d) => d.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));
    this.publish();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Czyści kreator (po opublikowaniu inicjatywy). */
  reset(): void {
    this.drafts.set([]);
    this.publish();
  }

  private problem(d: Draft): string | null {
    if (!d.label.trim()) return 'Wpisz treść pytania';
    if (this.hasOptions(d.type)) {
      const count = optionsOf(d.options).length;
      if (count < 2) return 'Dodaj co najmniej dwie opcje (każda w osobnym wierszu)';
      if (count > this.limits.maxOptions) return `Najwyżej ${this.limits.maxOptions} opcji`;
    }
    return null;
  }

  private publish(): void {
    const drafts = this.drafts();
    this.valid.set(drafts.every((d) => this.problem(d) === null));
    this.questions.set(
      drafts
        .filter((d) => this.problem(d) === null)
        .map((d, i): NewQuestion => ({
          key: `q${i + 1}`,
          label: d.label.trim(),
          type: d.type,
          required: d.required,
          ...(this.hasOptions(d.type) ? { options: optionsOf(d.options) } : {}),
        })),
    );
  }
}
