import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../../core/catalog/catalog.service';
import { EncounterService } from '../../../core/encounter.service';
import { TYPES } from '../../../core/game.model';
import { describeError, toApiError } from '../../../core/http/api-error';
import { Pokemon } from '../../../core/pokemon.model';
import { Pokestop, SurveyAnswer, SurveyAnswers, SurveyQuestion } from '../../../core/pokestop.model';
import { PokestopService } from '../../../core/pokestop.service';
import { compactAnswers, ratingScale, validateAnswers } from '../../../core/survey.utils';
import { Icon } from '../../../shared/icon/icon';
import { SpryciakModel } from '../../../shared/spryciak-model/spryciak-model';

/**
 * Ankieta zaufanego podmiotu, a po jej wysłaniu ekran nagrody: dopiero tam gracz dowiaduje się, jaki Spryciak wpadł mu w nagrodę
 * (na mapie inicjatywa jest wykrzyknikiem i gatunku nie zdradza). Odpowiedzi sprawdzamy lokalnie, a ostatnie słowo ma serwer.
 */
@Component({
  selector: 'app-survey',
  imports: [SpryciakModel, RouterLink, Icon],
  templateUrl: './survey.html',
  styleUrl: './survey.css',
})
export class Survey {
  private readonly pokestops = inject(PokestopService);
  private readonly encounters = inject(EncounterService);
  private readonly catalog = inject(CatalogService);

  readonly stop = input.required<Pokestop>();
  readonly closed = output<void>();

  protected readonly types = TYPES;
  protected readonly questions = computed<SurveyQuestion[]>(() => this.stop().questions ?? []);
  protected readonly answers = signal<SurveyAnswers>({});
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** Nagroda po wysłaniu ankiety; do tej chwili gatunek jest tajemnicą. */
  protected readonly reward = signal<Pokemon | null>(null);
  protected readonly species = computed(() => {
    const pokemon = this.reward();
    return pokemon ? this.catalog.character(pokemon.character) : null;
  });

  protected scale(q: SurveyQuestion): number[] {
    return ratingScale(q);
  }

  protected answer(key: string): SurveyAnswer | undefined {
    return this.answers()[key];
  }

  protected set(key: string, value: SurveyAnswer): void {
    this.answers.update((a) => ({ ...a, [key]: value }));
    this.errors.update(({ [key]: _gone, ...rest }) => rest);
  }

  protected setNumber(key: string, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.set(key, text === '' ? '' : Number(text));
  }

  protected setText(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement).value);
  }

  protected isPicked(key: string, value: string): boolean {
    const current = this.answers()[key];
    return Array.isArray(current) && current.includes(value);
  }

  protected toggle(key: string, value: string): void {
    const current = this.answers()[key];
    const list = Array.isArray(current) ? current : [];
    this.set(key, list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const answers = compactAnswers(this.answers());
    const local = validateAnswers(this.questions(), answers);
    this.formError.set(null);
    this.errors.set(local);
    if (Object.keys(local).length) {
      this.formError.set('Uzupełnij zaznaczone pytania.');
      return;
    }
    const position = this.encounters.userPosition();
    if (!position) {
      this.formError.set('Włącz lokalizację, żeby wysłać ankietę. Musisz być na miejscu.');
      return;
    }
    this.busy.set(true);
    try {
      this.reward.set(await this.pokestops.answerSurvey(this.stop().id, answers, position));
    } catch (error) {
      const e = toApiError(error);
      this.errors.set(e.fields);
      this.formError.set(describeError(e));
    } finally {
      this.busy.set(false);
    }
  }
}
