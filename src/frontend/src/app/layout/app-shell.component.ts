import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { UiStore } from '../core/stores/ui.store';
import { AuthStore } from '../core/stores/auth.store';
import { SidebarComponent } from './sidebar.component';
import { BottomNavComponent } from './bottom-nav.component';
import { HeaderComponent } from './header.component';
import { ToastContainerComponent } from '../shared/components/toast/toast-container.component';
import { routeAnimations } from '../animations/route-animations';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    BottomNavComponent,
    HeaderComponent,
    ToastContainerComponent,
  ],
  template: `
    <header class="app-header">
      <app-header />
    </header>

    <div class="app-layout">
      <aside class="app-sidebar" [class.open]="uiStore.sidebarOpen()">
        <app-sidebar />
      </aside>

      <main class="app-main" id="main-content">
        <div [@routeAnimations]="getRouterOutletState(outlet)">
          <router-outlet #outlet="outlet" />
        </div>
      </main>
    </div>

    <nav class="app-bottom-nav">
      <app-bottom-nav />
    </nav>

    <app-toast-container />
  `,
  animations: [routeAnimations],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
      }

      .app-header {
        position: sticky;
        top: 0;
        z-index: var(--z-index-2);
      }

      .app-layout {
        display: flex;
        flex: 1;
      }

      .app-sidebar {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        bottom: var(--bottom-nav-height);
        z-index: var(--z-index-3);
        width: var(--sidebar-width-expanded);
        background: var(--color-bg-secondary);
        border-right: 1px solid var(--color-border);
        transform: translateX(-100%);
        transition: transform var(--duration-normal) var(--ease-out);

        &.open {
          transform: translateX(0);
        }
      }

      .app-main {
        flex: 1;
        min-width: 0;
        padding-bottom: calc(var(--bottom-nav-height) + var(--space-4));
        padding-top: var(--space-4);
      }

      .app-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: var(--z-index-2);
      }

      @media (min-width: 768px) {
        .app-sidebar {
          display: block;
          position: sticky;
          top: 56px;
          bottom: auto;
          height: calc(100dvh - 56px);
          transform: none;
          width: var(--sidebar-width-collapsed);
          transition: width var(--duration-normal) var(--ease-out);

          &.open {
            width: var(--sidebar-width-expanded);
          }
        }

        .app-main {
          padding-bottom: var(--space-4);
        }

        .app-bottom-nav {
          display: none;
        }
      }
    `,
  ],
})
export class AppShellComponent {
  readonly uiStore = inject(UiStore);
  readonly authStore = inject(AuthStore);

  getRouterOutletState(outlet: RouterOutlet): string {
    return outlet.isActivated ? outlet.activatedRoute.snapshot.url.join('/') : '';
  }
}
