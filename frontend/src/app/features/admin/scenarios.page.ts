import { Component } from '@angular/core';
import { ORG_SCENARIOS, RESIDENT_SCENARIOS } from '../../core/scenario.catalog';
import { Scenario } from '../../core/scenario.model';
import { allFields } from '../../core/scenario.utils';

/** Podgląd katalogów scenariuszy (tylko do odczytu). Docelowo edytowalny i pobierany z API. */
@Component({
  selector: 'app-scenarios-page',
  templateUrl: './scenarios.page.html',
  styleUrl: './scenarios.page.css',
})
export class ScenariosPage {
  protected readonly groups = [
    { title: 'Mieszkańcy', scenarios: RESIDENT_SCENARIOS },
    { title: 'Zaufane organizacje', scenarios: ORG_SCENARIOS },
  ];

  protected fieldCount(s: Scenario): number {
    return allFields(s).length;
  }
}
