import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component'; // <-- Cambiado a app.component

bootstrapApplication(AppComponent, appConfig) // <-- Cambiado a AppComponent
  .catch((err) => console.error(err));
