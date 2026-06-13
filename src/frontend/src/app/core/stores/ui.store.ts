import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';
export type UnitSystem = 'metric' | 'imperial';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  action?: string;
  actionLabel?: string;
  dismissAfter?: number;
  dismissible?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UiStore {
  private readonly THEME_KEY = 'mixologyhub-theme';
  private readonly UNIT_KEY = 'mixologyhub-unit';

  readonly theme = signal<Theme>(this.getInitialTheme());
  readonly unitSystem = signal<UnitSystem>(this.getInitialUnitSystem());
  readonly sidebarOpen = signal<boolean>(false);
  readonly online = signal<boolean>(navigator.onLine);
  readonly toasts = signal<Toast[]>([]);

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  setUnitSystem(unit: UnitSystem): void {
    this.unitSystem.set(unit);
    localStorage.setItem(this.UNIT_KEY, unit);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  addToast(toast: Toast): void {
    const t = { ...toast, id: toast.id || crypto.randomUUID() };
    this.toasts.update((arr) => [...arr, t]);
    const duration = toast.dismissAfter ?? (toast.action ? 15000 : 5000);
    if (duration > 0) {
      setTimeout(() => this.removeToast(t.id), duration);
    }
  }

  removeToast(id: string): void {
    this.toasts.update((arr) => arr.filter((t) => t.id !== id));
  }

  private getInitialTheme(): Theme {
    const stored = localStorage.getItem(this.THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'dark';
  }

  private getInitialUnitSystem(): UnitSystem {
    const stored = localStorage.getItem(this.UNIT_KEY);
    if (stored === 'metric' || stored === 'imperial') {
      return stored;
    }
    return 'metric';
  }

  private applyTheme(theme: Theme): void {
    const el = document.documentElement;
    if (theme === 'light') {
      el.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      el.removeAttribute('data-theme');
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      if (prefersLight) {
        el.setAttribute('data-theme', 'light');
      } else {
        el.removeAttribute('data-theme');
      }
    }
  }
}
