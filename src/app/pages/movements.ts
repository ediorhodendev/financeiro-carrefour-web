import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BankStore } from '../core/bank-store';
import { Balance, Entry, Statement } from '../core/contracts';
import { money } from '../core/money';
import { Icon } from '../shared/icon';
import { Entries } from '../shared/entries';
import { TransactionDialog } from '../shared/transaction-dialog';
@Component({
  imports: [FormsModule, DatePipe, Icon, Entries, TransactionDialog],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">LEDGER APPEND-ONLY</span>
        <h1>Movimentações<span class="heading-dot">.</span></h1>
        <p>Cada lançamento permanece no histórico. Estornos são compensatórios.</p>
      </div>
      <button
        class="button primary"
        [disabled]="!store.session.connected()"
        (click)="original.set(null); dialog.set(true)"
      >
        <app-icon name="plus" />Nova movimentação
      </button>
    </div>
    <div class="history-grid">
      <section class="panel history-card">
        <div>
          <span class="square-icon"><app-icon name="clock" /></span>
          <h2>Saldo em um instante</h2>
          <p>Consulte a posição histórica da conta, em UTC.</p>
        </div>
        <label>Instante UTC<input type="datetime-local" step="1" [(ngModel)]="at" /></label
        ><button
          class="button secondary"
          [disabled]="!store.session.connected() || historicalLoading()"
          (click)="getHistorical()"
        >
          Consultar saldo
        </button>
        @if (historical(); as balance) {
          <div class="historical-result">
            <strong>{{ money(balance.amount, true) }}</strong
            ><small>{{ balance.at | date: 'dd/MM/yyyy HH:mm:ss' : 'UTC' }} UTC</small>
          </div>
        }
      </section>
      <section class="panel history-info">
        <span class="eyebrow">COMO FUNCIONA</span>
        <h2>O passado preservado.</h2>
        <p>
          O saldo histórico considera os lançamentos até o instante solicitado. Um estorno posterior
          não apaga nem altera o saldo do passado.
        </p>
        <div class="info-box">
          <app-icon name="info" />
          <p>
            A leitura acompanha os eventos processados. Durante uma interrupção do worker, o Ledger
            continua validando o saldo real.
          </p>
        </div>
      </section>
    </div>
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Extrato da conta</h2>
          <p>Datas em UTC · paginação sobre o histórico projetado.</p>
        </div>
        <span class="tag"
          >{{
            (data()?.account === store.accountId() ? data()?.value?.total : store.total()) ?? 0
          }}
          registros</span
        >
      </div>
      <div class="filter-bar">
        <label>De (UTC)<input type="datetime-local" step="1" [(ngModel)]="from" /></label
        ><label>Até (UTC)<input type="datetime-local" step="1" [(ngModel)]="to" /></label
        ><label
          >Por página<select [(ngModel)]="size">
            <option [ngValue]="8">8</option>
            <option [ngValue]="20">20</option>
            <option [ngValue]="50">50</option>
          </select></label
        ><button
          class="button secondary"
          [disabled]="!store.session.connected() || loading()"
          (click)="load(1)"
        >
          <app-icon name="search" />Aplicar filtros
        </button>
      </div>
      @if (error()) {
        <div class="inline-error margin-inline" role="alert">{{ error() }}</div>
      }
      <app-entries
        [entries]="visibleEntries()"
        [disabled]="!store.session.connected()"
        (reverse)="original.set($event); dialog.set(true)"
      />
      <div class="table-footer">
        <span
          >Página {{ current()?.page ?? 1 }} ·
          {{ current()?.total ?? store.total() }} registros</span
        >
        <div class="button-row">
          <button
            class="button secondary compact"
            [disabled]="!current() || current()!.page <= 1 || loading()"
            (click)="load((current()?.page ?? 1) - 1)"
          >
            Anterior</button
          ><button
            class="button secondary compact"
            [disabled]="
              !current() || current()!.page * current()!.size >= current()!.total || loading()
            "
            (click)="load((current()?.page ?? 1) + 1)"
          >
            Próxima<app-icon name="chevron" />
          </button>
        </div>
      </div>
    </section>
    @if (dialog()) {
      <app-transaction-dialog [original]="original()" (dismiss)="dialog.set(false); load(1)" />
    }
  `,
  styles: '',
})
export class Movements {
  readonly store = inject(BankStore);
  readonly data = signal<{ account: string; value: Statement } | null>(null);
  readonly historicalData = signal<{ account: string; value: Balance } | null>(null);
  readonly dialog = signal(false);
  readonly original = signal<Entry | null>(null);
  readonly loading = signal(false);
  readonly historicalLoading = signal(false);
  readonly error = signal('');
  from = '';
  to = '';
  at = '';
  size = 8;
  readonly money = money;
  current(): Statement | null {
    return this.data()?.account === this.store.accountId()
      ? this.data()!.value
      : this.store.statement();
  }
  visibleEntries(): Entry[] {
    return this.current()?.items ?? [];
  }
  historical(): Balance | null {
    return this.historicalData()?.account === this.store.accountId()
      ? this.historicalData()!.value
      : null;
  }
  utc(value: string): string {
    const date = new Date(value + 'Z');
    if (Number.isNaN(date.getTime())) throw new Error('Informe uma data válida em UTC.');
    return date.toISOString();
  }
  async load(page: number): Promise<void> {
    if (!this.store.session.connected() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const account = this.store.accountId();
    try {
      const params = new URLSearchParams({ pagina: String(page), tamanho: String(this.size) });
      if (this.from) params.set('de', this.utc(this.from));
      if (this.to) params.set('ate', this.utc(this.to));
      const value = (
        await this.store.api.request<Statement>(
          'GET',
          `/api/balance/api/v1/contas/${account}/extrato?${params}`,
        )
      ).value;
      if (account === this.store.accountId()) this.data.set({ account, value });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Não foi possível consultar.');
    } finally {
      this.loading.set(false);
    }
  }
  async getHistorical(): Promise<void> {
    if (!this.at) {
      this.store.notice('error', 'Informe o instante', 'Selecione data e hora em UTC.');
      return;
    }
    this.historicalLoading.set(true);
    const account = this.store.accountId();
    try {
      const value = (
        await this.store.api.request<Balance>(
          'GET',
          `/api/balance/api/v1/contas/${account}/saldo?em=${encodeURIComponent(this.utc(this.at))}`,
        )
      ).value;
      this.historicalData.set({ account, value });
    } catch (e) {
      this.store.fail(e);
    } finally {
      this.historicalLoading.set(false);
    }
  }
}
