import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  importProvidersFrom,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule, icons, ShieldAlert } from 'lucide-angular';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { AuthStore } from './core/stores/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    importProvidersFrom(LucideAngularModule.pick({ ...icons, ShieldAlert })),
    {
      provide: APP_INITIALIZER,
      useFactory: (authStore: AuthStore) => () => firstValueFrom(authStore.initialize()),
      deps: [AuthStore],
      multi: true,
    },
  ],
};
