import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'discover',
    pathMatch: 'full',
  },
  {
    path: 'discover',
    loadComponent: () => import('./pages/discover/discover.page').then((m) => m.DiscoverPage),
  },
  {
    path: 'discover/:id',
    loadComponent: () =>
      import('./pages/discover/cocktail-detail.page').then((m) => m.CocktailDetailPage),
  },
  {
    path: 'my-bar',
    loadComponent: () => import('./pages/my-bar/my-bar.page').then((m) => m.MyBarPage),
    canActivate: [authGuard],
  },
  {
    path: 'ai-bartender',
    loadComponent: () =>
      import('./pages/ai-bartender/ai-bartender.page').then((m) => m.AiBartenderPage),
    canActivate: [authGuard],
  },
  {
    path: 'ai-bartender/:id',
    loadComponent: () =>
      import('./pages/ai-bartender/ai-recipe-detail.page').then((m) => m.AiRecipeDetailPage),
    canActivate: [authGuard],
  },
  {
    path: 'favorites',
    loadComponent: () => import('./pages/favorites/favorites.page').then((m) => m.FavoritesPage),
    canActivate: [authGuard],
  },
  {
    path: 'create',
    loadComponent: () => import('./pages/create/create.page').then((m) => m.CreatePage),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage),
    canActivate: [authGuard],
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./pages/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'auth/verify-email',
    loadComponent: () => import('./pages/auth/verify-email.page').then((m) => m.VerifyEmailPage),
  },
  {
    path: 'auth/confirm-email-change',
    loadComponent: () =>
      import('./pages/auth/confirm-email-change.page').then((m) => m.ConfirmEmailChangePage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
    canActivate: [authGuard],
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
