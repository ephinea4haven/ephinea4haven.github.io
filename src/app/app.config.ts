import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling, UrlSerializer } from '@angular/router';
import { PublicUrlSerializer } from './shared/public-url-serializer';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: UrlSerializer, useClass: PublicUrlSerializer },
    provideClientHydration(),
    provideRouter(routes, withInMemoryScrolling()),
    provideZonelessChangeDetection(),
  ],
};
