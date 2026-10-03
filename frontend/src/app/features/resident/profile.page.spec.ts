import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_PROVIDERS } from '../../core/api/api-providers';
import { provideTestConfig } from '../../core/config/testing';
import { ProfilePage } from './profile.page';

describe('ProfilePage (konto demo na atrapach)', () => {
  async function render() {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), provideRouter([]), ...API_PROVIDERS] });
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the mid-game level, the three strongest Spryciaki and participation in city matters', async () => {
    const el = await render();
    expect(el.querySelector('.level')?.textContent).toContain('7');
    const top = [...el.querySelectorAll('.top .mon small')].map((s) => s.textContent);
    expect(top).toHaveLength(3);
    expect(top[0]).toContain('Poziom 7');
    const stats = Object.fromEntries([...el.querySelectorAll('.stat')].map((s) => [s.querySelector('span')!.textContent, Number(s.querySelector('strong')!.textContent)]));
    expect(stats['zgłoszonych problemów']).toBe(1);
    expect(stats['pomysłów i miejsc']).toBe(1);
    expect(stats['konsultacji z Twoim głosem']).toBe(2);
    expect(stats['oddanych głosów']).toBe(4);
  });
});
