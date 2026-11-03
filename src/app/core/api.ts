import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { Session } from './session';
import { parseFinancialJson } from './money';
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
  }
}
export interface ApiResponse<T> {
  value: T;
  status: number;
  replayed: boolean;
}
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);
  async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: string,
    key?: string,
  ): Promise<ApiResponse<T>> {
    let headers = new HttpHeaders();
    if (this.session.token())
      headers = headers.set('Authorization', 'Bearer ' + this.session.token());
    if (body !== undefined) headers = headers.set('Content-Type', 'application/json');
    if (key) headers = headers.set('Idempotency-Key', key);
    try {
      const response: HttpResponse<string> = await firstValueFrom(
        this.http
          .request(method, path, { body, headers, observe: 'response', responseType: 'text' })
          .pipe(timeout(20000)),
      );
      return {
        value: parseFinancialJson<T>(response.body || '{}'),
        status: response.status,
        replayed: response.headers.get('Idempotency-Replayed') === 'true',
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) this.session.clear();
        let problem: { detail?: string; title?: string } = {};
        try {
          problem = typeof error.error === 'string' ? JSON.parse(error.error) : error.error;
        } catch {
          /* Do not expose proxy HTML or payloads. */
        }
        const text = problem?.detail || problem?.title || '';
        const translated = text.includes('Insufficient funds')
          ? 'Saldo autoritativo insuficiente para esta operação.'
          : text.includes('already reversed')
            ? 'Este lançamento já foi estornado.'
            : text.includes('cannot be reversed')
              ? 'Não é permitido estornar um estorno.'
              : text.includes('different content')
                ? 'Esta chave já foi usada com outro conteúdo. Uma nova intenção exige outra chave.'
                : error.status === 401
                  ? 'Sua sessão expirou. Conecte o ambiente novamente.'
                  : error.status === 403
                    ? 'Seu token não tem o escopo necessário.'
                    : error.status === 404
                      ? 'Conta ainda sem projeção, inexistente ou sem acesso.'
                      : error.status === 429
                        ? 'Limite de requisições atingido. Aguarde antes de repetir.'
                        : error.status === 409 && /progress|Concurrent|busy/i.test(text)
                          ? 'Há uma operação em andamento. Reenvie a mesma intenção após aguardar.'
                          : error.status >= 500 || error.status === 0
                            ? 'Não foi possível confirmar a resposta. Verifique a conexão e repita com a mesma chave.'
                            : text || 'Não foi possível concluir a solicitação.';
        throw new ApiFailure(error.status, translated, error.headers.get('Retry-After'));
      }
      throw new ApiFailure(
        0,
        'A resposta demorou além do esperado. Reenvie a mesma intenção para evitar duplicidade.',
      );
    }
  }
}
