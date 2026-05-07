import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { UiStore } from '../../core/stores/ui.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="container">
      <h1 class="page-title">Admin Dashboard</h1>

      <nav class="admin-tabs">
        <button
          class="tab"
          [class.active]="activeTab() === 'reports'"
          (click)="activeTab.set('reports')"
        >
          Reports
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'ingredients'"
          (click)="activeTab.set('ingredients')"
        >
          Ingredients
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'hidden'"
          (click)="activeTab.set('hidden')"
        >
          Hidden Cocktails
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'settings'"
          (click)="activeTab.set('settings')"
        >
          Settings
        </button>
      </nav>

      @switch (activeTab()) {
        @case ('reports') {
          <section>
            <h2 class="section-title">Content Reports</h2>
            <div class="actions-bar">
              <app-button variant="outline" (action)="loadReports()">Refresh</app-button>
            </div>
            @if (reportsLoading()) {
              @for (i of [1, 2, 3]; track i) {
                <app-skeleton type="row" />
              }
            } @else if (reports().length === 0) {
              <p class="empty">No pending reports.</p>
            } @else {
              @for (report of reports(); track report.id) {
                <div class="report-card card">
                  <div class="report-header">
                    <strong>{{ report.reportReason }}</strong>
                    @if (report.cocktail) {
                      <span class="cocktail-name">{{ report.cocktail.name }}</span>
                    }
                    @if (report.externalCocktailId) {
                      <span class="cocktail-name">External #{{ report.externalCocktailId }}</span>
                    }
                    <app-badge type="ai" [label]="report.status" />
                  </div>
                  @if (report.details) {
                    <p class="report-details">{{ report.details }}</p>
                  }
                  <div class="report-meta">
                    <span class="meta-item">Reported: {{ report.createdAt | date: 'short' }}</span>
                  </div>
                  <div class="report-actions">
                    <select
                      class="form-input status-select"
                      [(ngModel)]="reportStatus[report.id]"
                      name="status{{ report.id }}"
                    >
                      <option value="resolved">Resolve</option>
                      <option value="dismissed">Dismiss</option>
                    </select>
                    <app-button
                      (action)="reviewReport(report.id, reportStatus[report.id] || 'resolved')"
                      >Apply</app-button
                    >
                  </div>
                </div>
              }
            }
          </section>
        }
        @case ('ingredients') {
          <section>
            <h2 class="section-title">Merge Ingredients</h2>
            <div class="merge-form card">
              <div class="form-group">
                <label class="form-label">Source Ingredient (to be removed)</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="mergeSourceSearch"
                  name="mergeSource"
                  placeholder="Search source ingredient..."
                  (input)="searchIngredients('source')"
                />
                @if (sourceResults.length > 0) {
                  <ul class="search-dropdown">
                    @for (r of sourceResults; track r.id) {
                      <li (click)="selectSource(r)">{{ r.name }}</li>
                    }
                  </ul>
                }
                @if (mergeSource) {
                  <p class="selected">Selected: {{ mergeSourceName }}</p>
                }
              </div>
              <div class="form-group">
                <label class="form-label">Target Ingredient (to keep)</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="mergeTargetSearch"
                  name="mergeTarget"
                  placeholder="Search target ingredient..."
                  (input)="searchIngredients('target')"
                />
                @if (targetResults.length > 0) {
                  <ul class="search-dropdown">
                    @for (r of targetResults; track r.id) {
                      <li (click)="selectTarget(r)">{{ r.name }}</li>
                    }
                  </ul>
                }
                @if (mergeTarget) {
                  <p class="selected">Selected: {{ mergeTargetName }}</p>
                }
              </div>
              <app-button
                [disabled]="!mergeSource || !mergeTarget || merging()"
                [loading]="merging()"
                (action)="doMerge()"
                >Merge</app-button
              >
              @if (mergeError()) {
                <p class="form-error">{{ mergeError() }}</p>
              }
            </div>
          </section>
        }
        @case ('hidden') {
          <section>
            <h2 class="section-title">Hidden External Cocktails</h2>
            <div class="hide-form card">
              <div class="form-group">
                <label class="form-label">External Cocktail ID</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="hideExternalId"
                  name="hideExternalId"
                  placeholder="e.g. 11007"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Reason</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="hideReason"
                  name="hideReason"
                  placeholder="Why is this hidden?"
                />
              </div>
              <div class="hide-actions">
                <app-button
                  [disabled]="!hideExternalId || hiding()"
                  [loading]="hiding()"
                  (action)="doHide()"
                  >Hide</app-button
                >
                <app-button
                  variant="outline"
                  [disabled]="!hideExternalId || hiding()"
                  (action)="doUnhide()"
                  >Unhide</app-button
                >
              </div>
              @if (hideError()) {
                <p class="form-error">{{ hideError() }}</p>
              }
            </div>
          </section>
        }
        @case ('settings') {
          <section>
            <h2 class="section-title">System Settings</h2>
            <div class="settings-form card">
              <div class="form-group">
                <label class="form-label">Setting Key</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="settingKey"
                  name="settingKey"
                  placeholder="e.g. max_ai_recipes_per_day"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Value</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="settingValue"
                  name="settingValue"
                  placeholder="e.g. 50"
                />
              </div>
              <div class="setting-actions">
                <app-button [disabled]="!settingKey || loadingSettings()" (action)="loadSetting()"
                  >Load</app-button
                >
                <app-button
                  variant="outline"
                  [disabled]="!settingKey || !settingValue || loadingSettings()"
                  (action)="saveSetting()"
                  >Save</app-button
                >
              </div>
              @if (settingsError()) {
                <p class="form-error">{{ settingsError() }}</p>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: [
    `
      .admin-tabs {
        display: flex;
        gap: var(--space-1);
        border-bottom: 1px solid var(--color-border);
        margin-bottom: var(--space-6);
        overflow-x: auto;
      }

      .tab {
        background: none;
        border: none;
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-body-small);
        color: var(--color-text-secondary);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        white-space: nowrap;
        transition: all var(--transition-fast);

        &.active,
        &:hover {
          color: var(--color-primary);
        }
        &.active {
          border-bottom-color: var(--color-primary);
        }
      }

      .section-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h5);
        margin-bottom: var(--space-4);
      }

      .actions-bar {
        margin-bottom: var(--space-4);
      }

      .report-card {
        padding: var(--space-4);
        margin-bottom: var(--space-3);
      }
      .report-header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
        flex-wrap: wrap;
      }
      .cocktail-name {
        color: var(--color-text-secondary);
        font-size: var(--font-size-body-small);
      }
      .report-details {
        color: var(--color-text-secondary);
        font-size: var(--font-size-body-small);
        margin-bottom: var(--space-2);
      }
      .report-meta {
        font-size: var(--font-size-caption);
        color: var(--color-text-tertiary);
        margin-bottom: var(--space-3);
      }
      .report-actions {
        display: flex;
        gap: var(--space-3);
        align-items: center;
      }
      .status-select {
        width: auto;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        font-size: var(--font-size-body-small);
      }

      .merge-form,
      .hide-form,
      .settings-form {
        padding: var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        position: relative;
      }
      .form-label {
        font-size: var(--font-size-body-small);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
      }
      .form-input {
        width: 100%;
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        font-size: var(--font-size-body);
        box-sizing: border-box;
      }
      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .search-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 150px;
        overflow-y: auto;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        z-index: 10;
        list-style: none;
        padding: var(--space-1) 0;
        margin: 2px 0 0;
      }
      .search-dropdown li {
        padding: var(--space-2) var(--space-3);
        cursor: pointer;
        font-size: var(--font-size-body-small);
      }
      .search-dropdown li:hover {
        background: var(--color-bg-tertiary);
      }

      .selected {
        font-size: var(--font-size-caption);
        color: var(--color-primary);
        margin-top: var(--space-1);
      }

      .hide-actions,
      .setting-actions {
        display: flex;
        gap: var(--space-3);
      }

      .form-error {
        color: var(--color-error);
        font-size: var(--font-size-body-small);
        margin: 0;
      }
      .empty {
        color: var(--color-text-tertiary);
        font-style: italic;
      }
    `,
  ],
})
export class AdminPage implements OnInit {
  private http = inject(HttpClient);
  readonly uiStore = inject(UiStore);

  activeTab = signal<'reports' | 'ingredients' | 'hidden' | 'settings'>('reports');

  // Reports
  reports = signal<any[]>([]);
  reportsLoading = signal(false);
  reportStatus: Record<string, string> = {};

  // Ingredient merge
  mergeSource = '';
  mergeSourceName = '';
  mergeTarget = '';
  mergeTargetName = '';
  mergeSourceSearch = '';
  mergeTargetSearch = '';
  sourceResults: any[] = [];
  targetResults: any[] = [];
  merging = signal(false);
  mergeError = signal<string | null>(null);

  // Hidden cocktails
  hideExternalId = '';
  hideReason = '';
  hiding = signal(false);
  hideError = signal<string | null>(null);

  // Settings
  settingKey = '';
  settingValue = '';
  loadingSettings = signal(false);
  settingsError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.reportsLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/admin/reports`).subscribe({
      next: (res: any) => {
        this.reports.set(res.data || res || []);
        this.reportsLoading.set(false);
      },
      error: () => {
        this.reportsLoading.set(false);
      },
    });
  }

  reviewReport(id: string, status: string): void {
    this.http.post(`${environment.apiUrl}/admin/reports/${id}/review`, { status }).subscribe({
      next: () => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: `Report ${status}.`,
          type: 'success',
        });
        this.loadReports();
      },
      error: () => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Failed to review report.',
          type: 'error',
        });
      },
    });
  }

  searchIngredients(type: 'source' | 'target'): void {
    const term = type === 'source' ? this.mergeSourceSearch : this.mergeTargetSearch;
    if (term.length < 1) {
      if (type === 'source') this.sourceResults = [];
      else this.targetResults = [];
      return;
    }
    this.http
      .get<any[]>(`${environment.apiUrl}/ingredients?name=${encodeURIComponent(term)}&limit=10`)
      .subscribe({
        next: (res: any) => {
          const items = res.data || res || [];
          if (type === 'source') this.sourceResults = items;
          else this.targetResults = items;
        },
      });
  }

  selectSource(item: any): void {
    this.mergeSource = item.id;
    this.mergeSourceName = item.name;
    this.mergeSourceSearch = item.name;
    this.sourceResults = [];
  }

  selectTarget(item: any): void {
    this.mergeTarget = item.id;
    this.mergeTargetName = item.name;
    this.mergeTargetSearch = item.name;
    this.targetResults = [];
  }

  doMerge(): void {
    this.merging.set(true);
    this.mergeError.set(null);
    this.http
      .post(`${environment.apiUrl}/admin/ingredients/merge`, {
        sourceId: this.mergeSource,
        targetId: this.mergeTarget,
      })
      .subscribe({
        next: () => {
          this.merging.set(false);
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Ingredients merged successfully.',
            type: 'success',
          });
          this.mergeSource =
            this.mergeTarget =
            this.mergeSourceName =
            this.mergeTargetName =
            this.mergeSourceSearch =
            this.mergeTargetSearch =
              '';
        },
        error: (err) => {
          this.merging.set(false);
          this.mergeError.set(err.error?.message || 'Merge failed.');
        },
      });
  }

  doHide(): void {
    this.hiding.set(true);
    this.hideError.set(null);
    this.http
      .post(`${environment.apiUrl}/admin/external-cocktails/hide`, {
        externalId: this.hideExternalId,
        reason: this.hideReason || 'Moderation',
      })
      .subscribe({
        next: () => {
          this.hiding.set(false);
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Cocktail hidden.',
            type: 'success',
          });
          this.hideExternalId = this.hideReason = '';
        },
        error: (err) => {
          this.hiding.set(false);
          this.hideError.set(err.error?.message || 'Failed to hide.');
        },
      });
  }

  doUnhide(): void {
    this.hiding.set(true);
    this.hideError.set(null);
    this.http
      .delete(`${environment.apiUrl}/admin/external-cocktails/${this.hideExternalId}/hide`)
      .subscribe({
        next: () => {
          this.hiding.set(false);
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Cocktail unhidden.',
            type: 'success',
          });
          this.hideExternalId = '';
        },
        error: (err) => {
          this.hiding.set(false);
          this.hideError.set(err.error?.message || 'Failed to unhide.');
        },
      });
  }

  loadSetting(): void {
    if (!this.settingKey) return;
    this.loadingSettings.set(true);
    this.http
      .get<any>(`${environment.apiUrl}/admin/settings/${encodeURIComponent(this.settingKey)}`)
      .subscribe({
        next: (res: any) => {
          this.settingValue = res.settingValue || res.value || '';
          this.loadingSettings.set(false);
        },
        error: (err) => {
          this.loadingSettings.set(false);
          this.settingsError.set(err.error?.message || 'Failed to load setting.');
        },
      });
  }

  saveSetting(): void {
    if (!this.settingKey || !this.settingValue) return;
    this.loadingSettings.set(true);
    this.http
      .post(`${environment.apiUrl}/admin/settings`, {
        key: this.settingKey,
        value: this.settingValue,
      })
      .subscribe({
        next: () => {
          this.loadingSettings.set(false);
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Setting saved.',
            type: 'success',
          });
        },
        error: (err) => {
          this.loadingSettings.set(false);
          this.settingsError.set(err.error?.message || 'Failed to save setting.');
        },
      });
  }
}
