import { Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';
import { Shell } from './features/shell/shell';

const map = () => import('./features/map/map.page').then((m) => m.MapPage);

const account = () => import('./features/account/account.page').then((m) => m.AccountPage);

/** Ekrany logowania i rejestracji: dostępne dla każdej roli (w powłoce z jej nawigacją). */
const authRoutes: Routes = [
  { path: 'logowanie', component: Shell, children: [{ path: '', loadComponent: () => import('./features/account/login.page').then((m) => m.LoginPage), title: 'Logowanie' }] },
  { path: 'rejestracja', component: Shell, children: [{ path: '', loadComponent: () => import('./features/account/register.page').then((m) => m.RegisterPage), title: 'Rejestracja' }] },
  {
    path: 'rejestracja-organizacji',
    component: Shell,
    children: [{ path: '', loadComponent: () => import('./features/account/register-org.page').then((m) => m.RegisterOrgPage), title: 'Konto organizacji' }],
  },
];

/** Trzy odrębne widoki w tej samej powłoce: mieszkaniec (/), zaufana organizacja (/org), administrator (/admin). */
export const routes: Routes = [
  ...authRoutes,
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
      { path: 'konto', loadComponent: account, title: 'Konto' },
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
      { path: 'profil', loadComponent: () => import('./features/resident/profile.page').then((m) => m.ProfilePage), title: 'Profil' },
      { path: 'konto', redirectTo: 'profil' },
    ],
  },
  { path: '**', redirectTo: '' },
];
