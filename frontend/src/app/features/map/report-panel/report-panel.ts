import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RESIDENT_CATEGORIES, scenariosFor, scenariosInCategory } from '../../../core/scenario.catalog';
import { FieldValues, Scenario, ScenarioCategory } from '../../../core/scenario.model';
import { toReport } from '../../../core/scenario.utils';
import { NewReport } from '../../../core/pokestop.model';
import { SessionService } from '../../../core/session.service';
import { ScenarioForm } from '../../../shared/scenario-form/scenario-form';

export type ReportDraft = Omit<NewReport, 'lat' | 'lng'>;

/** Panel tworzenia pinezki: krok 1 wybór scenariusza z katalogu, krok 2 formularz scenariusza. */
@Component({
  selector: 'app-report-panel',
  imports: [ScenarioForm],
  templateUrl: './report-panel.html',
  styleUrl: './report-panel.css',
})
export class ReportPanel {
  private readonly session = inject(SessionService);

  readonly drafted = output<ReportDraft>();

  protected readonly isOrg = computed(() => this.session.role() === 'org');
  protected readonly organization = computed(() => this.session.profile().organization);
  protected readonly categories = RESIDENT_CATEGORIES;
  /** Wybrana kategoria (mieszkaniec); organizacja pomija ten krok. */
  protected readonly category = signal<ScenarioCategory | null>(null);
  protected readonly chosen = signal<Scenario | null>(null);
  protected readonly categoryMeta = computed(() => RESIDENT_CATEGORIES.find((c) => c.id === this.category()) ?? null);
  protected readonly catalog = computed(() => {
    if (this.isOrg()) return scenariosFor('org');
    const category = this.category();
    return category ? scenariosInCategory(category) : [];
  });
  /** Kroki: 'category' -> 'scenario' -> 'form'. */
  protected readonly step = computed(() => (this.chosen() ? 'form' : this.isOrg() || this.category() ? 'scenario' : 'category'));

  protected back(): void {
    if (this.chosen()) this.chosen.set(null);
    else this.category.set(null);
  }

  protected submit(scenario: Scenario, values: FieldValues): void {
    this.drafted.emit(toReport(scenario, values, this.organization()));
    this.chosen.set(null);
    this.category.set(null);
  }
}
