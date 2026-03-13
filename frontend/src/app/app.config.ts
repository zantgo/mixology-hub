import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers:[
    // Usamos el detector de cambios moderno (Zoneless) en su versión estable
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient()
  ]
};
