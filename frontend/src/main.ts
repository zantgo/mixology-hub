import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component'; // <-- Changed to app.component

bootstrapApplication(AppComponent, appConfig) // <-- Changed to AppComponent
  .catch((err) => console.error(err));
