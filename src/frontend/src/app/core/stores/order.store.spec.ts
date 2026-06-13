import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderStore, PrepareResponse } from './order.store';
import { environment } from '../../../environments/environment';

describe('OrderStore', () => {
  let store: OrderStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrderStore],
    });

    store = TestBed.inject(OrderStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    store.reset();
  });

  it('should submit an order and transition status to queued', async () => {
    const mockResponse: PrepareResponse = {
      message: 'Cocktail preparation queued',
      preparationLogId: 'log-123',
      jobId: 'job-456',
      status: 'queued',
      statusUrl: '/cocktails/preparations/log-123/status',
    };

    const promise = store.submitOrder('cocktail-789', 2, false);

    const req = httpMock.expectOne(
      `${environment.apiUrl}/cocktails/cocktail-789/prepare?servings=2`,
    );
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    const res = await promise;
    expect(res).toEqual(mockResponse);
    expect(store.status()).toBe('queued');
    expect(store.currentLogId()).toBe('log-123');
  });

  it('should poll status until a terminal state is reached', async () => {
    vi.useFakeTimers();

    store.startPolling('log-123');

    // First poll (immediate)
    const req1 = httpMock.expectOne(
      `${environment.apiUrl}/cocktails/preparations/log-123/status`,
    );
    req1.flush({ status: 'queued', cocktailName: 'Martini' });
    expect(store.status()).toBe('queued');

    // Advance past the 1500ms interval for the second poll
    vi.advanceTimersByTime(1500);

    const req2 = httpMock.expectOne(
      `${environment.apiUrl}/cocktails/preparations/log-123/status`,
    );
    req2.flush({ status: 'completed', cocktailName: 'Martini' });

    expect(store.status()).toBe('completed');
    expect(store.polling()).toBe(false); // Polling stops on terminal state

    vi.useRealTimers();
  });

  it('should stop polling when status transitions to cancelled', async () => {
    vi.useFakeTimers();

    store.startPolling('log-123');

    const req1 = httpMock.expectOne(
      `${environment.apiUrl}/cocktails/preparations/log-123/status`,
    );
    req1.flush({ status: 'cancelled', cocktailName: 'Martini' });

    expect(store.status()).toBe('cancelled');
    expect(store.polling()).toBe(false);
    expect(store.isTerminal).toBe(true);

    vi.useRealTimers();
  });

  it('should cancel an order via the cancel endpoint', async () => {
    store.currentLogId.set('log-123');
    store.status.set('queued');
    store.polling.set(true);

    const promise = store.cancel('log-123');

    const req = httpMock.expectOne(
      `${environment.apiUrl}/cocktails/preparations/log-123/cancel`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Preparation cancelled successfully', preparationLogId: 'log-123', status: 'cancelled' });

    await promise;
    expect(store.status()).toBe('cancelled');
    expect(store.polling()).toBe(false);
    expect(store.cancelling()).toBe(false);
  });
});
