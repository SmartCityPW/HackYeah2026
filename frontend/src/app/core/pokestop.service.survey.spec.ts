import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from './api/api-providers';
import { provideTestConfig } from './config/testing';
import { ApiHttpError, TooFarError } from './http/api-error';
import { PokemonService } from './pokemon.service';
import { PokestopService } from './pokestop.service';

describe('PokestopService: ankieta zaufanego podmiotu (atrapa działa jak backend)', () => {
  let service: PokestopService;
  let pokemons: PokemonService;
  const TREES = 7; // Fundacja Zielone Miasto: postać `tree`
  const GOOD = { support: true, priorities: ['shade'], volunteer: 2 };
  const stop = () => service.stops().find((s) => s.id === TREES)!;
  const here = () => ({ lat: stop().lat, lng: stop().lng });

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    service = TestBed.inject(PokestopService);
    pokemons = TestBed.inject(PokemonService);
    await service.loadAll();
    await pokemons.refresh();
  });

  it('rewards the filled survey with a new pokemon of the initiative\'s species, only once', async () => {
    const before = pokemons.pokemons().length;
    const pokemon = await service.answerSurvey(TREES, GOOD, here());
    expect(pokemon.character).toBe('tree');
    expect(stop().surveyAnswered).toBe(true);
    await pokemons.refresh();
    expect(pokemons.pokemons().length).toBe(before + 1);

    const again = await service.answerSurvey(TREES, GOOD, here()).catch((e) => e);
    expect((again as ApiHttpError).code).toBe('already_answered');
  });

  it('refuses answers from outside the interaction circle', async () => {
    const error = await service.answerSurvey(TREES, GOOD, { lat: stop().lat + 0.01, lng: stop().lng }).catch((e) => e);
    expect(error).toBeInstanceOf(TooFarError);
    expect(stop().surveyAnswered).toBe(false);
  });

  it('reports invalid answers under the question key', async () => {
    const error = (await service.answerSurvey(TREES, { priorities: ['shade'] }, here()).catch((e) => e)) as ApiHttpError;
    expect(error.status).toBe(422);
    expect(error.fields['support']).toBeTruthy();
  });

  it('closes the survey when the organizer resolves the initiative', async () => {
    await service.manage(TREES, { status: 'resolved' });
    const error = (await service.answerSurvey(TREES, GOOD, here()).catch((e) => e)) as ApiHttpError;
    expect(error.code).toBe('survey_closed');
  });

  it('aggregates results for the organizer', async () => {
    await service.answerSurvey(TREES, { support: false, priorities: ['shade', 'noise'], volunteer: 4 }, here());
    const results = await service.surveyResults(TREES);
    const by = Object.fromEntries(results.questions.map((q) => [q.key, q]));
    expect(results.responseCount).toBe(3);
    expect(by['support'].counts).toEqual({ true: 2, false: 1 });
    expect(by['priorities'].counts).toEqual({ shade: 2, noise: 2, air: 1 });
    expect(by['volunteer'].average).toBe(3.5);
  });

  it('keeps the questions fetched from the details when a later list reload brings none', async () => {
    const { questions } = stop();
    expect(questions?.length).toBeGreaterThan(0);
    await service.loadAll();
    expect(stop().questions).toEqual(questions);
  });
});
