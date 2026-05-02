import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type PreparationStatus =
  | 'queued'
  | 'completed'
  | 'failed_insufficient_stock'
  | 'failed_other';

export interface PreparationStatusResponse {
  preparationLogId: string;
  cocktailName: string | null;
  servings: number;
  status: PreparationStatus;
  deductedIngredients: Record<string, unknown>[] | null;
  undone: boolean;
  createdAt: string;
}

export interface PrepareResponse {
  message: string;
  preparationLogId: string;
  jobId: string;
  status: 'queued';
  statusUrl: string;
}

@Injectable({ providedIn: 'root' })
export class OrderStore {
  private http = inject(HttpClient);

  readonly currentLogId = signal<string | null>(null);
  readonly status = signal<PreparationStatus | null>(null);
  readonly cocktailName = signal<string | null>(null);
  readonly polling = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  submitOrder(cocktailId: string, servings: number = 1, force: boolean = false): Promise<PrepareResponse> {
    const params: Record<string, string> = {};
    if (servings !== 1) params['servings'] = servings.toString();
    if (force) params['force'] = 'true';

    return this.http
      .post<PrepareResponse>(
        `${environment.apiUrl}/cocktails/${cocktailId}/prepare`,
        {},
        { params },
      )
      .toPromise()
      .then((res) => {
        if (!res) throw new Error('No response from prepare endpoint');
        this.currentLogId.set(res.preparationLogId);
        this.status.set('queued');
        return res;
      });
  }

  startPolling(logId: string): void {
    this.stopPolling();
    this.polling.set(true);

    const poll = () => {
      this.http
        .get<PreparationStatusResponse>(
          `${environment.apiUrl}/cocktails/preparations/${logId}/status`,
        )
        .subscribe({
          next: (res) => {
            this.status.set(res.status);
            this.cocktailName.set(res.cocktailName);

            if (res.status === 'completed' || res.status.startsWith('failed')) {
              this.stopPolling();
            }
          },
          error: () => {
            // Keep polling on transient errors
          },
        });
    };

    poll(); // immediate first poll
    this.pollInterval = setInterval(poll, 1500);
  }

  stopPolling(): void {
    this.polling.set(false);
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  get isTerminal(): boolean {
    const s = this.status();
    return s === 'completed' || s === 'failed_insufficient_stock' || s === 'failed_other';
  }

  reset(): void {
    this.stopPolling();
    this.currentLogId.set(null);
    this.status.set(null);
    this.cocktailName.set(null);
    this.error.set(null);
  }
}
