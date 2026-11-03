import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Api, ApiFailure } from './api';
import { Session } from './session';
import {
  Account,
  Balance,
  Consolidated,
  DemoAccess,
  Entry,
  Notice,
  Operation,
  QueueMetrics,
  RuntimeConfig,
  Statement,
  SystemStatus,
} from './contracts';
@Injectable({ providedIn: 'root' })
export class BankStore {
  readonly api = inject(Api);
  readonly session = inject(Session);
  private readonly destroy = inject(DestroyRef);
  readonly balance = signal<Balance | null>(null);
  readonly statement = signal<Statement | null>(null);
  readonly accountId = signal('');
  readonly accounts = signal<string[]>([]);
  readonly operations = signal<Operation[]>([]);
  readonly metrics = signal<QueueMetrics | null>(null);
  readonly status = signal<SystemStatus | null>(null);
  readonly config = signal<RuntimeConfig>({ mode: 'live', metricsEnabled: false });
  readonly notices = signal<Notice[]>([]);
  readonly loading = signal(false);
  readonly connecting = signal(false);
  readonly lastChecked = signal<string | null>(null);
  readonly readError = signal('');
  readonly now = signal(Date.now());
  private refreshing = false;
  private accountVersion = 0;
  readonly accountOperations = computed(() =>
    this.operations().filter((o) => o.accountId === this.accountId()),
  );
  readonly pending = computed(() =>
    this.accountOperations().filter(
      (o) => o.state === 'confirmed' || o.state === 'sending' || o.state === 'uncertain',
    ),
  );
  readonly latest = computed<Operation | null>(() => this.accountOperations()[0] ?? null);
  readonly total = computed(() => this.statement()?.total ?? 0);
  readonly minutesLeft = computed(() =>
    Math.max(0, Math.ceil((this.session.expiresAt() - this.now()) / 60000)),
  );
  readonly newestSequence = computed(() =>
    Math.max(
      this.balance()?.lastSequence ?? 0,
      ...this.accountOperations().map((o) => o.entry?.sequence ?? 0),
    ),
  );
  constructor() {
    void this.loadConfig();
    void this.checkStatus();
    interval(5000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        this.now.set(Date.now());
        if (this.session.connected() && this.session.expiresAt() <= Date.now()) {
          this.session.clear();
          this.notice('info', 'Sessão expirada', 'Conecte novamente para continuar.');
        }
        if (this.session.connected()) void this.refresh(false);
      });
    interval(15000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => void this.checkStatus());
  }
  async loadConfig(): Promise<void> {
    try {
      this.config.set((await this.api.request<RuntimeConfig>('GET', '/api/config')).value);
    } catch {
      /* The status panel handles connectivity. */
    }
  }
  async checkStatus(): Promise<void> {
    try {
      this.status.set((await this.api.request<SystemStatus>('GET', '/api/status')).value);
    } catch {
      this.status.set({ ledger: false, balance: false, observedAt: new Date().toISOString() });
    }
  }
  async connectDemo(): Promise<void> {
    if (this.connecting()) return;
    this.connecting.set(true);
    try {
      const access = (await this.api.request<DemoAccess>('POST', '/api/ledger/demo/access')).value;
      this.setSession(access.token, access.accountId);
      this.notice(
        'success',
        'Ambiente conectado',
        'JWT de demonstração ativo. Nenhuma movimentação foi criada.',
      );
      await this.refresh(true);
    } catch (e) {
      this.fail(e);
    } finally {
      this.connecting.set(false);
    }
  }
  async connectToken(token: string, account: string): Promise<boolean> {
    try {
      this.setSession(token, account);
      await this.refresh(true);
      return this.session.connected();
    } catch (e) {
      this.fail(e);
      return false;
    }
  }
  private setSession(token: string, account: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account))
      throw new Error('Informe um ID de conta UUID válido.');
    const old = this.session.subject();
    this.session.set(token);
    if (old && old !== this.session.subject()) {
      this.operations.set([]);
      this.accounts.set([]);
    }
    this.selectAccount(account);
    this.now.set(Date.now());
  }
  selectAccount(id: string): void {
    if (!id) return;
    this.accountVersion++;
    this.accountId.set(id);
    this.balance.set(null);
    this.statement.set(null);
    this.readError.set('');
    this.accounts.update((ids) => [...new Set([...ids, id])]);
    if (this.session.connected()) void this.refresh(true);
  }
  async openAccount(): Promise<void> {
    try {
      const account = (await this.api.request<Account>('POST', '/api/ledger/api/v1/contas')).value;
      this.selectAccount(account.id);
      this.notice(
        'success',
        'Conta criada',
        'Saldo inicial zero. A projeção aparecerá após o primeiro lançamento.',
      );
    } catch (e) {
      this.notice(
        'error',
        'Não foi possível confirmar o cadastro',
        'A abertura de conta não é idempotente. Não repita automaticamente se a resposta foi perdida.',
      );
    }
  }
  async refresh(showLoading = false): Promise<void> {
    if (!this.session.connected() || !this.accountId() || this.refreshing) return;
    this.refreshing = true;
    if (showLoading) this.loading.set(true);
    const account = this.accountId(),
      version = this.accountVersion;
    try {
      const [read, queue] = await Promise.allSettled([
        this.api.request<Balance>('GET', `/api/balance/api/v1/contas/${account}/saldo`),
        this.api.request<QueueMetrics>('GET', '/api/messaging'),
      ]);
      if (version !== this.accountVersion) return;
      this.metrics.set(queue.status === 'fulfilled' ? queue.value.value : null);
      if (read.status === 'fulfilled') {
        const value = read.value.value;
        const changed = this.balance()?.lastSequence !== value.lastSequence;
        this.balance.set(value);
        this.readError.set('');
        this.operations.update((ops) =>
          ops.map((o) =>
            o.accountId === account &&
            o.entry &&
            o.entry.sequence <= value.lastSequence &&
            o.state === 'confirmed'
              ? { ...o, state: 'projected' }
              : o,
          ),
        );
        if (changed || !this.statement()) {
          const statement = (
            await this.api.request<Statement>(
              'GET',
              `/api/balance/api/v1/contas/${account}/extrato?pagina=1&tamanho=8`,
            )
          ).value;
          if (version === this.accountVersion) this.statement.set(statement);
        }
      } else if (read.reason instanceof ApiFailure && read.reason.status === 404) {
        this.balance.set(null);
        this.readError.set('Aguardando a primeira projeção desta conta.');
      } else {
        this.readError.set(
          read.reason instanceof Error ? read.reason.message : 'Leitura indisponível.',
        );
      }
      this.lastChecked.set(new Date().toISOString());
      if (showLoading && this.session.connected()) {
        try {
          const all = (
            await this.api.request<Consolidated>('GET', '/api/balance/api/v1/clientes/me/saldo')
          ).value;
          if (version === this.accountVersion)
            this.accounts.update((ids) => [
              ...new Set([...ids, ...all.accounts.map((a) => a.accountId)]),
            ]);
        } catch {
          /* No invented consolidated balance on failure. */
        }
      }
    } catch (e) {
      if (version === this.accountVersion)
        this.readError.set(e instanceof Error ? e.message : 'Leitura indisponível.');
    } finally {
      this.refreshing = false;
      this.loading.set(false);
      if (version !== this.accountVersion && this.session.connected()) void this.refresh(true);
    }
  }
  async submit(operation: Operation): Promise<Operation> {
    if (
      this.operations().some(
        (o) =>
          o.key === operation.key && o.accountId === operation.accountId && o.state === 'sending',
      )
    )
      throw new Error('Esta intenção já está sendo enviada.');
    this.replaceOperation({ ...operation, state: 'sending', error: undefined });
    try {
      const response = await this.api.request<Entry>(
        'POST',
        operation.path,
        operation.body,
        operation.key,
      );
      const entry = response.value;
      const result: Operation = {
        ...operation,
        entry,
        state:
          entry.sequence <= (this.balance()?.lastSequence ?? -1) &&
          operation.accountId === this.accountId()
            ? 'projected'
            : 'confirmed',
        replayed: response.replayed,
        httpStatus: response.status,
        error: undefined,
      };
      this.replaceOperation(result);
      this.notice(
        'success',
        response.replayed ? 'Repetição segura reconhecida' : 'Operação confirmada no Ledger',
        response.replayed
          ? 'Mesmo ID e sequência. Nenhum novo lançamento foi criado.'
          : `Sequência ${entry.sequence}. Aguardando a leitura incorporar o evento.`,
      );
      void this.refresh(false);
      return result;
    } catch (e) {
      const failure = e instanceof ApiFailure ? e : new ApiFailure(0, 'Resposta não confirmada.');
      const uncertain =
        failure.status === 0 ||
        failure.status >= 500 ||
        failure.status === 408 ||
        failure.status === 429 ||
        (failure.status === 409 && !!failure.retryAfter);
      const result: Operation = {
        ...operation,
        state: uncertain ? 'uncertain' : 'rejected',
        error: failure.message,
        httpStatus: failure.status,
      };
      this.replaceOperation(result);
      this.notice(
        uncertain ? 'info' : 'error',
        uncertain ? 'Confirmação pendente' : 'Operação rejeitada',
        failure.message,
      );
      return result;
    }
  }
  async retry(operation: Operation): Promise<Operation> {
    if (Date.now() - Date.parse(operation.startedAt) >= 48 * 60 * 60 * 1000) {
      this.notice(
        'error',
        'Chave fora da retenção',
        'Reconcilie o lançamento antes de reenviar: a chave pode ter expirado no servidor.',
      );
      return operation;
    }
    try {
      return await this.submit(operation);
    } catch (e) {
      this.fail(e);
      return operation;
    }
  }
  private replaceOperation(operation: Operation): void {
    this.operations.update((ops) =>
      [
        operation,
        ...ops.filter((o) => !(o.key === operation.key && o.accountId === operation.accountId)),
      ].slice(0, 100),
    );
  }
  notice(kind: Notice['kind'], title: string, detail: string): void {
    const id = Date.now() + Math.random();
    this.notices.update((all) => [...all.slice(-2), { id, kind, title, detail }]);
    setTimeout(() => this.dismiss(id), 8000);
  }
  dismiss(id: number): void {
    this.notices.update((all) => all.filter((n) => n.id !== id));
  }
  fail(error: unknown): void {
    this.notice(
      'error',
      'Não foi possível concluir',
      error instanceof Error ? error.message : 'Verifique a conexão.',
    );
  }
  disconnect(): void {
    this.session.clear();
    this.balance.set(null);
    this.statement.set(null);
    this.metrics.set(null);
    this.operations.set([]);
    this.accounts.set([]);
    this.accountId.set('');
    this.accountVersion++;
  }
}
