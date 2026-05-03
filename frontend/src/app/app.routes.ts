import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'discover',
    pathMatch: 'full',
  },
  {
    path: 'discover',
    loadComponent: () =>
      import('./pages/discover/discover.page').then((m) => m.DiscoverPage),
  },
  {
    path: 'discover/:id',
    loadComponent: () =>
      import('./pages/discover/cocktail-detail.page').then(
        (m) => m.CocktailDetailPage,
      ),
  },
  {
    path: 'my-bar',
    loadComponent: () =>
      import('./pages/my-bar/my-bar.page').then((m) => m.MyBarPage),
  },
  {
    path: 'ai-bartender',
    loadComponent: () =>
      import('./pages/ai-bartender/ai-bartender.page').then(
        (m) => m.AiBartenderPage,
      ),
  },
  {
    path: 'ai-bartender/:id',
    loadComponent: () =>
      import('./pages/ai-bartender/ai-recipe-detail.page').then(
        (m) => m.AiRecipeDetailPage,
      ),
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./pages/favorites/favorites.page').then(
        (m) => m.FavoritesPage,
      ),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./pages/create/create.page').then(
        (m) => m.CreatePage,
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin.page').then(
        (m) => m.AdminPage,
      ),
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./pages/auth/login.page').then(
        (m) => m.LoginPage,
      ),
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./pages/auth/register.page').then(
        (m) => m.RegisterPage,
      ),
  },
  {
    path: 'auth/verify-email',
    loadComponent: () =>
      import('./pages/auth/verify-email.page').then(
        (m) => m.VerifyEmailPage,
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.page').then(
        (m) => m.ProfilePage,
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.page').then(
        (m) => m.NotFoundPage,
      ),
  },
];
