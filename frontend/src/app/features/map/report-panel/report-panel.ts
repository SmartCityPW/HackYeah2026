import { Component, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { CatalogService } from '../../../core/catalog/catalog.service';
import { RESIDENT_CATEGORIES, scenariosFor, scenariosInCategory } from '../../../core/scenario.catalog';
import { FieldValues, Scenario, ScenarioCategory } from '../../../core/scenario.model';
import { toReport } from '../../../core/scenario.utils';
import { NewQuestion, NewReport, isTrustedType } from '../../../core/pokestop.model';
import { PokemonService } from '../../../core/pokemon.service';
import { ToastService } from '../../../core/toast.service';
import { SessionService } from '../../../core/session.service';
import { QuestionBuilder } from '../../../shared/question-builder/question-builder';
import { ScenarioForm } from '../../../shared/scenario-form/scenario-form';

export type ReportDraft = Omit<NewReport, 'lat' | 'lng'>;

/** Panel tworzenia pinezki: krok 1 wybór scenariusza z katalogu, krok 2 formularz scenariusza. */
@Component({
  selector: 'app-report-panel',
  imports: [ScenarioForm, QuestionBuilder],
  templateUrl: './report-panel.html',
  styleUrl: './report-panel.css',
})
export class ReportPanel {
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly pokemons = inject(PokemonService);

  readonly drafted = output<ReportDraft>();
  /** Czy celownik stoi w kółku interakcji gracza (tylko tam można dodać pinezkę). */
  readonly pinInRange = input(true);

  /** Pytania ankiety dopisane przez organizację (tylko kompletne) i to, czy wszystkie rozpoczęte pytania są kompletne. */
  protected readonly questions = signal<NewQuestion[]>([]);
  protected readonly questionsValid = signal(true);
  protected readonly builder = viewChild(QuestionBuilder);
  protected readonly isOrg = computed(() => this.session.role() === 'org');
  protected readonly organization = computed(() => this.session.profile().organization);
  protected readonly categories = RESIDENT_CATEGORIES;
  /** Wybrana kategoria (mieszkaniec); organizacja pomija ten krok. */
  protected readonly category = signal<ScenarioCategory | null>(null);
  protected readonly chosen = signal<Scenario | null>(null);
  protected readonly characterCatalog = inject(CatalogService);
  protected readonly available = this.pokemons.available;
  /** Zgłoszenie problemu i pomysł mieszkańca wymagają zostawienia na nim własnego pokemona (dostaje go z powrotem po poparciu). */
  protected readonly needsStake = computed(() => {
    const type = this.chosen()?.pokestopType;
    return type === 'report' || type === 'idea';
  });
  /** Pokemon zostawiany na zgłoszeniu; domyślnie pierwszy wolny, a gdy zniknie z listy (np. został zastawiony), znów pierwszy wolny. */
  protected readonly stakedId = linkedSignal<number | null>(() => this.available()[0]?.id ?? null);
  protected readonly categoryMeta = computed(() => RESIDENT_CATEGORIES.find((c) => c.id === this.category()) ?? null);
  protected readonly catalog = computed(() => {
    if (this.isOrg()) return scenariosFor('org');
    const category = this.category();
    return category ? scenariosInCategory(category) : [];
  });
  /** Kroki: 'category' -> 'scenario' -> 'form'. */
  protected readonly step = computed(() => (this.chosen() ? 'form' : this.isOrg() || this.category() ? 'scenario' : 'category'));

  /** Ankietę można dodać do inicjatywy zaufanego podmiotu (pomysł NGO, konsultacje). */
  protected readonly canHaveSurvey = computed(() => this.isOrg() && !!this.chosen() && isTrustedType(this.chosen()!.pokestopType));

  protected back(): void {
    this.clearSurvey();
    if (this.chosen()) this.chosen.set(null);
    else this.category.set(null);
  }

  protected onStakedChosen(event: Event): void {
    this.stakedId.set(Number((event.target as HTMLSelectElement).value));
  }

  protected submit(scenario: Scenario, values: FieldValues): void {
    if (!this.pinInRange()) return;
    if (!this.questionsValid()) {
      this.toast.show('Dokończ albo usuń niekompletne pytania ankiety.', '⚠️');
      return;
    }
    const report = toReport(scenario, values, this.organization());
    const staked = this.needsStake();
    if (staked && this.stakedId() === null) {
      this.toast.show('Nie masz wolnego pokemona do zostawienia na zgłoszeniu. Odzyskasz go, gdy inne zgłoszenie zdobędzie poparcie.');
      return;
    }
    const questions = this.canHaveSurvey() ? this.questions() : [];
    this.drafted.emit({ ...report, ...(staked ? { stakedPokemonId: this.stakedId()! } : {}), ...(questions.length ? { questions } : {}) });
  }

  private clearSurvey(): void {
    this.builder()?.reset();
    this.questions.set([]);
    this.questionsValid.set(true);
  }

  /** Wraca do wyboru rodzaju zgłoszenia. Rodzic woła to po udanym dodaniu, a po błędzie zostawia formularz z wpisanymi danymi. */
  reset(): void {
    this.clearSurvey();
    this.chosen.set(null);
    this.category.set(null);
  }
}
