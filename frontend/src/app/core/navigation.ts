import type { IconName } from '../shared/icon/icon';
import { Role } from './session.service';

export interface NavItem {
  label: string;
  icon: IconName;
  path: string;
  /** Dopasowanie dokładne (dla "home", żeby nie świecił na podstronach). */
  exact?: boolean;
  /** Funkcja zapowiedziana, jeszcze niedostępna. */
  soon?: boolean;
  /** Liczba do pokazania na przycisku jako odznaka (np. nowe odrzucenia moderacji AI). Ustawia powłoka. */
  badge?: number;
  /** Co zasila odznakę; powłoka podstawia `badge`. */
  badgeSource?: 'moderation';
}

export const ROLE_HOME: Record<Role, string> = { resident: '/', org: '/org', admin: '/admin' };

/** Adres ekranu mapy dla danej roli (do przejść typu "pokaż na mapie"). */
/** Profil gracza (cel przycisku poziomu na mapie). */
export const PROFILE_PATH: Record<Role, string> = { resident: '/profil', org: '/org/organizacja', admin: '/admin/konto' };

export const MAP_PATH: Record<Role, string> = { resident: '/', org: '/org', admin: '/admin/mapa' };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  resident: [
    { label: 'Mapa', icon: 'map', path: '/', exact: true },
    { label: 'Moje Spryciaki', icon: 'spryciaki', path: '/spryciaki' },
    { label: 'Inicjatywy', icon: 'list', path: '/inicjatywy' },
    { label: 'Profil', icon: 'user', path: '/profil' },
  ],
  org: [
    { label: 'Mapa', icon: 'map', path: '/org', exact: true },
    { label: 'Inicjatywy', icon: 'list', path: '/org/inicjatywy' },
    { label: 'Wydarzenia', icon: 'calendar', path: '/org/wydarzenia' },
    { label: 'Organizacja', icon: 'building', path: '/org/organizacja' },
  ],
  admin: [
    { label: 'Moderacja', icon: 'shield', path: '/admin', exact: true, badgeSource: 'moderation' },
    { label: 'Organizacje', icon: 'building', path: '/admin/organizacje' },
    { label: 'Scenariusze', icon: 'grid', path: '/admin/scenariusze' },
    { label: 'Mapa', icon: 'map', path: '/admin/mapa' },
    { label: 'Konto', icon: 'user', path: '/admin/konto' },
  ],
};
