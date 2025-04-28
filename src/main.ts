// import { ApplicationConfig } from '@angular/core';
// import { provideAnimations } from '@angular/platform-browser/animations';

// export const appConfig: ApplicationConfig = {
//   providers: [
//     provideAnimations() // 👈 This replaces BrowserAnimationsModule
//   ]
// };




import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
