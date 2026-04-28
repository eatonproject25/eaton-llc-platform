import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { provideRouter } from '@angular/router';
import { routes } from './app-routing.module'; // <-- add this

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),                    // <-- add this
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
