import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { API_PROVIDERS } from './api/api-providers';
import { provideTestConfig } from './config/testing';
import { roleGuard } from './role.guard';
import { SessionService } from './session.service';

describe('roleGuard', () => {
  const run = (guardRole: 'resident' | 'org' | 'admin', current: 'resident' | 'org' | 'admin') => {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    TestBed.inject(SessionService).setRole(current);
    return TestBed.runInInjectionContext(() => roleGuard(guardRole)({} as never, {} as never));
  };

  it('allows a matching role', () => {
    expect(run('org', 'org')).toBe(true);
  });

  it('sends a resident away from the admin area to the resident home', () => {
    const result = run('admin', 'resident') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/');
  });

  it('sends an organization away from the resident area to its own home', () => {
    const result = run('resident', 'org') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/org');
  });
});
