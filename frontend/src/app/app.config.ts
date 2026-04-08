import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers:[
    // Use the modern change detector (Zoneless) in its stable version
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient()
  ]
};
