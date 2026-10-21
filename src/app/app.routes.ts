import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Codeforces Repractice — find the problems that beat you',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  {
    path: 'u/:handle',
    title: 'Codeforces Repractice',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then((m) => m.DashboardPage),
  },
  { path: '**', redirectTo: '' },
];
