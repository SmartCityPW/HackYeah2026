import { Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';
import { Shell } from './features/shell/shell';

const map = () => import('./features/map/map.page').then((m) => m.MapPage);

/** Trzy odrębne widoki w tej samej powłoce: mieszkaniec (/), zaufana organizacja (/org), administrator (/admin). */
export const routes: Routes = [
  {
    path: 'org',
    component: Shell,
    canActivate: [roleGuard('org')],
    children: [
      { path: '', loadComponent: map, title: 'Mapa' },
      { path: 'inicjatywy', loadComponent: () => import('./features/org/org-initiatives.page').then((m) => m.OrgInitiativesPage), title: 'Inicjatywy organizacji' },
      { path: 'organizacja', loadComponent: () => import('./features/org/org-profile.page').then((m) => m.OrgProfilePage), title: 'Organizacja' },
    ],
  },
  {
    path: 'admin',
    component: Shell,
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', loadComponent: () => import('./features/admin/moderation.page').then((m) => m.ModerationPage), title: 'Moderacja' },
      { path: 'organizacje', loadComponent: () => import('./features/admin/organizations.page').then((m) => m.OrganizationsPage), title: 'Organizacje' },
      { path: 'scenariusze', loadComponent: () => import('./features/admin/scenarios.page').then((m) => m.ScenariosPage), title: 'Scenariusze' },
      { path: 'mapa', loadComponent: map, title: 'Mapa' },
    ],
  },
  {
    path: '',
    component: Shell,
    canActivate: [roleGuard('resident')],
    children: [
      { path: '', loadComponent: map, title: 'Mapa' },
      { path: 'spryciaki', loadComponent: () => import('./features/resident/spryciaki.page').then((m) => m.SpryciakiPage), title: 'Moje Spryciaki' },
      { path: 'inicjatywy', loadComponent: () => import('./features/resident/initiatives.page').then((m) => m.InitiativesPage), title: 'Moje inicjatywy' },
    ],
  },
  { path: '**', redirectTo: '' },
];
