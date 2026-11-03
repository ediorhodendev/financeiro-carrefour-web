import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BankStore } from '../core/bank-store';
import { money } from '../core/money';
import { Entry } from '../core/contracts';
import { Icon } from '../shared/icon';
import { Flow } from '../shared/flow';
import { Entries } from '../shared/entries';
import { TransactionDialog } from '../shared/transaction-dialog';
@Component({
  imports: [DatePipe, RouterLink, Icon, Flow, Entries, TransactionDialog],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">SEU AMBIENTE FINANCEIRO</span>
        <h1>Visão geral<span class="heading-dot">.</span></h1>
        <p>Acompanhe suas operações, do lançamento ao saldo consolidado.</p>
      </div>
      <div class="button-row">
        <button
          class="button secondary"
          [disabled]="!store.session.connected() || store.loading()"
          (click)="store.refresh(true)"
        >
          <app-icon name="refresh" />Atualizar</button
        ><button
          class="button primary"
          [disabled]="!store.session.connected()"
          (click)="original.set(null); dialog.set(true)"
        >
          <app-icon name="plus" />Nova movimentação
        </button>
      </div>
    </div>
    <div class="stats-grid">
      <section class="balance-card">
        <div class="card-topline">
          <span><app-icon name="wallet" />Saldo disponível na leitura</span
          ><span class="currency-tag">BRL</span>
        </div>
        <strong class="balance-amount" data-testid="current-balance">{{
          money(store.balance()?.amount)
        }}</strong>
        <div class="balance-bottom">
          <span class="balance-indicator"></span
          ><span>{{
            store.balance()
              ? store.readError()
                ? 'Última leitura disponível'
                : 'Projeção atualizada'
              : 'Aguardando conexão ou projeção'
          }}</span
          ><app-icon name="shield" />
        </div>
        <div class="balance-decoration"></div>
      </section>
      <section class="stat-card">
        <span class="stat-icon blue"><app-icon name="arrows" /></span
        ><span class="stat-label">Movimentações</span
        ><strong>{{ store.statement() ? store.total() : '—' }}</strong
        ><small>Total projetado nesta conta</small>
      </section>
      <section class="stat-card">
        <span class="stat-icon violet"><app-icon name="database" /></span
        ><span class="stat-label">Última sequência</span
        ><strong>{{ store.balance() ? '#' + store.balance()?.lastSequence : '—' }}</strong
        ><small>{{
          store.pending().length
            ? store.pending().length + ' intenção(ões) aguardando confirmação'
            : 'Leitura consistente por sequência'
        }}</small>
      </section>
      <section class="stat-card">
        <span class="stat-icon amber"><app-icon name="queue" /></span
        ><span class="stat-label">Mensagens na fila</span
        ><strong>{{ store.metrics()?.available ? store.metrics()?.ready : '—' }}</strong
        ><small>Prontas · fila global RabbitMQ</small>
      </section>
    </div>
    @if (store.readError() && store.session.connected()) {
      <div class="read-notice">
        <app-icon name="info" /><span
          >{{ store.readError() }} O saldo exibido é uma projeção assíncrona; a validação de débito
          ocorre no Ledger.</span
        >
      </div>
    }
    <div class="overview-columns">
      <section class="panel pipeline-panel">
        <div class="panel-heading">
          <div>
            <h2>Uma operação, quatro etapas</h2>
            <p>Rastreabilidade da escrita à leitura.</p>
          </div>
          <a class="text-button" routerLink="/mensageria"
            >Ver mensageria<app-icon name="arrow"
          /></a>
        </div>
        <app-flow />
        <div class="pipeline-footer">
          <span><i class="status-dot"></i>Atualização automática a cada 5 segundos</span
          ><span>Consistência eventual</span>
        </div>
      </section>
      <section class="panel protection-card">
        <span class="protection-icon"><app-icon name="shield" /></span>
        <h2>Segurança em cada intenção</h2>
        <p>A chave de idempotência protege seu lançamento em tentativas repetidas.</p>
        <a class="text-button" routerLink="/guia">Entenda como testar<app-icon name="arrow" /></a>
      </section>
    </div>
    <section class="panel recent-panel">
      <div class="panel-heading">
        <div>
          <h2>
            Últimas movimentações <span class="count-badge">{{ store.total() }}</span>
          </h2>
          <p>Créditos, débitos e estornos da conta selecionada.</p>
        </div>
        <a class="text-button" routerLink="/movimentacoes"
          >Ver extrato completo<app-icon name="arrow"
        /></a>
      </div>
      <app-entries
        [entries]="store.statement()?.items ?? []"
        [disabled]="!store.session.connected()"
        (reverse)="original.set($event); dialog.set(true)"
      />
      <div class="table-footer">
        <span
          ><app-icon name="clock" />
          @if (store.lastChecked()) {
            Última consulta {{ store.lastChecked() | date: 'HH:mm:ss' : 'UTC' }} UTC
          } @else {
            Ainda sem consulta
          }</span
        ><span>Até 8 registros · ordem de sequência</span>
      </div>
    </section>
    @if (dialog()) {
      <app-transaction-dialog [original]="original()" (dismiss)="dialog.set(false)" />
    }
  `,
  styles: '',
})
export class Overview {
  readonly store = inject(BankStore);
  readonly dialog = signal(false);
  readonly original = signal<Entry | null>(null);
  readonly money = money;
}
