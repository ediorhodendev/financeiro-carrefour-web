import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Api, ApiFailure } from './api';
import { Session } from './session';
describe('API transport', () => {
  let api: Api;
  let http: HttpTestingController;
  let session: Session;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(Api);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
  });
  afterEach(() => http.verify());
  it('preserves the exact raw body and key on an intentional retry', async () => {
    const raw = '{"tipo":"Credito","valor":999999999999999.9999,"descricao":"x"}';
    for (let i = 0; i < 2; i++) {
      const promise = api.request('POST', '/api/ledger/example', raw, 'intent-1');
      const req = http.expectOne('/api/ledger/example');
      expect(req.request.body).toBe(raw);
      expect(req.request.headers.get('Idempotency-Key')).toBe('intent-1');
      req.flush('{"amount":999999999999999.9999}', {
        status: 201,
        statusText: 'Created',
        headers: { 'Idempotency-Replayed': String(i === 1) },
      });
      const result = await promise;
      expect(result.replayed).toBe(i === 1);
      expect(result.value).toEqual({ amount: '999999999999999.9999' });
    }
  });
  it('clears an expired session on 401', async () => {
    session.token.set('expired');
    const promise = api.request('GET', '/api/balance/example');
    const outcome = expect(promise).rejects.toMatchObject({ status: 401 });
    http
      .expectOne('/api/balance/example')
      .flush('{"title":"Unauthorized"}', { status: 401, statusText: 'Unauthorized' });
    await outcome;
    expect(session.token()).toBe('');
  });
  it('keeps Retry-After for an in-progress intention', async () => {
    const promise = api.request('POST', '/api/ledger/example', '{}', 'same');
    const outcome = expect(promise).rejects.toEqual(
      expect.objectContaining({ status: 409, retryAfter: '2' }),
    );
    http
      .expectOne('/api/ledger/example')
      .flush('{"detail":"Operation in progress"}', {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Retry-After': '2' },
      });
    await outcome;
  });
});
