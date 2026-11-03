import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview').then((m) => m.Overview),
    title: 'Visão geral · Carrefour Financeiro',
  },
  {
    path: 'movimentacoes',
    loadComponent: () => import('./pages/movements').then((m) => m.Movements),
    title: 'Movimentações · Carrefour Financeiro',
  },
  {
    path: 'mensageria',
    loadComponent: () => import('./pages/messaging').then((m) => m.Messaging),
    title: 'Mensageria · Carrefour Financeiro',
  },
  {
    path: 'guia',
    loadComponent: () => import('./pages/guide').then((m) => m.Guide),
    title: 'Como testar · Carrefour Financeiro',
  },
  { path: '**', redirectTo: '' },
];
