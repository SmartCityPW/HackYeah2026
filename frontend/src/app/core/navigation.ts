import { Role } from './session.service';

export interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Dopasowanie dokładne (dla "home", żeby nie świecił na podstronach). */
  exact?: boolean;
  /** Funkcja zapowiedziana, jeszcze niedostępna. */
  soon?: boolean;
}

export const ROLE_HOME: Record<Role, string> = { resident: '/', org: '/org', admin: '/admin' };

/** Adres ekranu mapy dla danej roli (do przejść typu "pokaż na mapie"). */
export const MAP_PATH: Record<Role, string> = { resident: '/', org: '/org', admin: '/admin/mapa' };

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  resident: [
    { label: 'Mapa', icon: '🗺️', path: '/', exact: true },
    { label: 'Spryciaki', icon: '🎒', path: '/spryciaki' },
    { label: 'Inicjatywy', icon: '📋', path: '/inicjatywy' },
    { label: 'Walka', icon: '⚔️', path: '/walka', soon: true },
  ],
  org: [
    { label: 'Mapa', icon: '🗺️', path: '/org', exact: true },
    { label: 'Inicjatywy', icon: '📋', path: '/org/inicjatywy' },
    { label: 'Organizacja', icon: '🏢', path: '/org/organizacja' },
  ],
  admin: [
    { label: 'Moderacja', icon: '🛡️', path: '/admin', exact: true },
    { label: 'Organizacje', icon: '🏢', path: '/admin/organizacje' },
    { label: 'Scenariusze', icon: '🧩', path: '/admin/scenariusze' },
    { label: 'Mapa', icon: '🗺️', path: '/admin/mapa' },
  ],
};
