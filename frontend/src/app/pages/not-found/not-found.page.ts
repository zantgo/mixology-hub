import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, ButtonComponent],
  template: `
    <div class="container not-found">
      <h1 class="code">404</h1>
      <h2 class="title">Page Not Found</h2>
      <p class="description">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <a routerLink="/discover" class="home-link">
        <app-button>Back to Discover</app-button>
      </a>
    </div>
  `,
  styles: [
    `
      .not-found {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60dvh;
        text-align: center;
        padding: var(--space-8);
      }

      .code {
        font-family: var(--font-family-heading);
        font-size: 6rem;
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        margin-bottom: var(--space-2);
        line-height: 1;
      }

      .title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h2);
        margin-bottom: var(--space-4);
      }

      .description {
        color: var(--color-text-secondary);
        margin-bottom: var(--space-8);
        max-width: 400px;
      }

      .home-link {
        text-decoration: none;
      }
    `,
  ],
})
export class NotFoundPage {}
