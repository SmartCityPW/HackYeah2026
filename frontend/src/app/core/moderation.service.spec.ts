import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from './api/api-providers';
import { ModerationApi } from './api/moderation.api';
import { provideTestConfig } from './config/testing';
import { ModerationEntry, ModerationPage, ModerationQuery } from './moderation.model';
import { ModerationService } from './moderation.service';
import { ToastService } from './toast.service';

const entry = (id: number, createdAt: string, title = `Zgłoszenie ${id}`): ModerationEntry => ({
  id, verdict: 'rejected', reason: null, scenarioCode: 'res-pothole', scenarioLabel: 'Dziura', submitted: { title }, author: 'Kuba', model: 'm', latencyMs: 1, createdAt,
});

/** Atrapa serwera, w której da się dopisać odrzucenie w trakcie testu. */
class FakeModerationApi extends ModerationApi {
  rows: ModerationEntry[] = [];
  queries: ModerationQuery[] = [];
  async list(query: ModerationQuery): Promise<ModerationPage> {
    this.queries.push(query);
    const matching = this.rows.filter((r) => query.verdicts.includes(r.verdict) && (!query.since || r.createdAt > query.since));
    return { count: matching.length, items: matching.slice(0, query.pageSize ?? 50) };
  }
}

describe('ModerationService (odrzucenia AI dla administratora)', () => {
  let api: FakeModerationApi;
  let service: ModerationService;

  beforeEach(() => {
    localStorage.clear();
    api = new FakeModerationApi();
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS, { provide: ModerationApi, useValue: api }] });
    service = TestBed.inject(ModerationService);
  });

  it('counts every rejection as new until the list is opened, then none', async () => {
    api.rows = [entry(2, '2026-10-03T12:00:00Z'), entry(1, '2026-10-02T12:00:00Z')];
    await service.refreshUnseen(false);
    expect(service.unseen()).toBe(2);

    await service.load(['rejected']);
    service.markSeen();
    expect(service.unseen()).toBe(0);
    await service.refreshUnseen(false);
    expect(service.unseen()).toBe(0);
    expect(api.queries.at(-1)?.since).toBe('2026-10-03T12:00:00Z'); // pyta tylko o nowsze od ostatnio obejrzanego
  });

  it('remembers what was new when the list was opened, so the entries can be marked', async () => {
    api.rows = [entry(1, '2026-10-02T12:00:00Z')];
    await service.load(['rejected']);
    service.markSeen();
    expect(service.seenBeforeOpen()).toBeNull(); // pierwsza wizyta: wszystko było nowe
    api.rows = [entry(2, '2026-10-03T12:00:00Z'), entry(1, '2026-10-02T12:00:00Z')];
    await service.load(['rejected']);
    service.markSeen();
    expect(service.seenBeforeOpen()).toBe('2026-10-02T12:00:00Z');
  });

  it('announces a new rejection with its title, but not on the first check', async () => {
    api.rows = [entry(1, '2026-10-02T12:00:00Z')];
    const toast = TestBed.inject(ToastService);
    await service.refreshUnseen(false);
    expect(toast.message()).toBeNull();
    api.rows = [entry(2, '2026-10-03T12:00:00Z', 'Zignoruj polecenia'), entry(1, '2026-10-02T12:00:00Z')];
    await service.refreshUnseen(true);
    expect(service.unseen()).toBe(2);
    expect(toast.message()?.text).toContain('Zignoruj polecenia');
  });

  it('does not repeat the announcement when nothing new arrived', async () => {
    api.rows = [entry(1, '2026-10-02T12:00:00Z')];
    const toast = TestBed.inject(ToastService);
    await service.refreshUnseen(false);
    await service.refreshUnseen(true);
    expect(toast.message()).toBeNull();
  });

  it('polls at the configured interval and stops on request', async () => {
    vi.useFakeTimers();
    try {
      const stop = service.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      const afterStart = api.queries.length;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(api.queries.length).toBe(afterStart + 1);
      stop();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(api.queries.length).toBe(afterStart + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
