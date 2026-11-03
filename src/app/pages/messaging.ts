import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BankStore } from '../core/bank-store';
import { Flow } from '../shared/flow';
import { Icon } from '../shared/icon';
import { Operation } from '../core/contracts';
@Component({
  imports: [DatePipe, Flow, Icon],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">CONFIABILIDADE EM TEMPO REAL</span>
        <h1>Mensageria<span class="heading-dot">.</span></h1>
        <p>Observe a fila e acompanhe o caminho das suas operações.</p>
      </div>
      <button
        class="button secondary"
        [disabled]="!store.session.connected()"
        (click)="store.refresh(true)"
      >
        <app-icon name="refresh" />Atualizar métricas
      </button>
    </div>
    <div class="read-notice">
      <app-icon name="info" /><span
        >As métricas abaixo são reais e globais do broker de demonstração. Elas não comprovam a
        entrega de uma operação específica. A sequência da conta comprova sua incorporação na
        leitura.</span
      >
    </div>
    <div class="metric-grid">
      @for (card of cards; track card.key) {
        <section class="panel metric-card">
          <span class="stat-icon" [class]="'stat-icon ' + card.color"
            ><app-icon [name]="card.icon" /></span
          ><span class="stat-label">{{ card.label }}</span
          ><strong>{{ store.metrics()?.available ? metric(card.key) : '—' }}</strong
          ><small>{{ card.detail }}</small>
        </section>
      }
    </div>
    @if (!store.metrics()?.available) {
      <div class="inline-warning">
        <app-icon name="info" />
        <div>
          <b>Métricas indisponíveis</b>
          <p>
            {{
              store.metrics()?.message ||
                'Conecte o ambiente e configure as credenciais RabbitMQ no gateway. Não exibimos contadores fictícios.'
            }}
          </p>
        </div>
      </div>
    }
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Da intenção à projeção</h2>
          <p>Transactional Outbox + consumidor idempotente.</p>
        </div>
        <span class="tag">At-least-once</span>
      </div>
      <app-flow />
      <div class="pipeline-footer">
        <span>Fila <code>bank.balance.v1</code></span
        ><span
          >{{ store.metrics()?.observedAt | date: 'HH:mm:ss' : 'UTC' }} UTC · janela do
          RabbitMQ</span
        >
      </div>
    </section>
    <div class="messaging-columns">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Intenções desta sessão</h2>
            <p>Somente a conta selecionada. Os dados não persistem ao recarregar.</p>
          </div>
          <span class="count-badge">{{ store.accountOperations().length }}</span>
        </div>
        <div class="operation-list">
          @for (op of store.accountOperations(); track op.key) {
            <article class="operation-row">
              <span class="entry-icon" [class.debit]="op.kind === 'debit'"
                ><app-icon
                  [name]="op.kind === 'reversal' ? 'undo' : op.kind === 'credit' ? 'down' : 'up'"
              /></span>
              <div class="operation-content">
                <b
                  >{{
                    op.kind === 'credit' ? 'Crédito' : op.kind === 'debit' ? 'Débito' : 'Estorno'
                  }}
                  @if (op.entry) {
                    <span class="muted">· #{{ op.entry.sequence }}</span>
                  }</b
                ><code>{{ op.key }}</code
                ><small
                  >{{ op.startedAt | date: 'HH:mm:ss' : 'UTC' }} UTC
                  @if (op.httpStatus) {
                    · HTTP {{ op.httpStatus }}
                  }
                  @if (op.replayed) {
                    · Replayed: true
                  }
                </small>
                @if (op.error) {
                  <p class="operation-error">{{ op.error }}</p>
                }
              </div>
              <div class="operation-actions">
                <span
                  class="state-badge"
                  [class.done]="op.state === 'projected'"
                  [class.failed]="op.state === 'rejected'"
                  >{{ stateLabel(op) }}</span
                >
                @if (
                  op.state === 'confirmed' || op.state === 'projected' || op.state === 'uncertain'
                ) {
                  <button
                    class="text-button small"
                    [disabled]="!store.session.connected()"
                    (click)="store.retry(op)"
                  >
                    <app-icon name="refresh" />{{
                      op.state === 'uncertain'
                        ? 'Reenviar mesma intenção'
                        : 'Testar repetição segura'
                    }}
                  </button>
                }
              </div>
            </article>
          } @empty {
            <div class="empty-state">
              <app-icon name="queue" />
              <h3>Seu próximo lançamento aparece aqui</h3>
              <p>
                Registre um crédito ou débito e acompanhe a confirmação e a sequência projetada.
              </p>
            </div>
          }
        </div>
      </section>
      <section class="panel broker-detail">
        <div class="panel-heading">
          <div>
            <h2>Diagnóstico do broker</h2>
            <p>Sem acesso a payloads ou dados de clientes.</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Publicação</dt>
            <dd>{{ rate(store.metrics()?.publishRate) }} msg/s</dd>
          </div>
          <div>
            <dt>Entrega / get</dt>
            <dd>{{ rate(store.metrics()?.deliveryRate) }} msg/s</dd>
          </div>
          <div>
            <dt>Acknowledgement</dt>
            <dd>{{ rate(store.metrics()?.ackRate) }} msg/s</dd>
          </div>
          <div>
            <dt>Consumidores push</dt>
            <dd>{{ store.metrics()?.available ? store.metrics()?.registeredConsumers : '—' }}</dd>
          </div>
        </dl>
        <div class="info-box">
          <app-icon name="info" />
          <p>
            O worker usa polling (<code>BasicGet</code>). É normal ter zero consumidores push
            registrados. A atividade é observada pelas entregas e pelo avanço da sequência.
          </p>
        </div>
      </section>
    </div>
    <section class="panel recovery-panel">
      <div>
        <span class="eyebrow">TESTE DE RESILIÊNCIA</span>
        <h2>Pause. Acumule. Recupere.</h2>
        <p>
          Na pasta do backend, pare apenas o worker. Faça um lançamento, observe a fila acumular e o
          saldo de leitura permanecer anterior. Retome o worker e acompanhe a recuperação.
        </p>
      </div>
      <div class="command-stack">
        <label
          >1. Pausar consumo<button
            class="code-button"
            (click)="copy('docker compose stop balance-worker')"
          >
            <code>docker compose stop balance-worker</code><app-icon name="copy" /></button></label
        ><label
          >2. Retomar consumo<button
            class="code-button"
            (click)="copy('docker compose start balance-worker')"
          >
            <code>docker compose start balance-worker</code><app-icon name="copy" /></button
        ></label>
      </div>
    </section>
  `,
  styles: '',
})
export class Messaging {
  readonly store = inject(BankStore);
  readonly cards = [
    {
      key: 'ready',
      label: 'Prontas para consumo',
      detail: 'Aguardando o worker',
      icon: 'queue',
      color: 'blue',
    },
    {
      key: 'unacknowledged',
      label: 'Sem confirmação',
      detail: 'Entregues, ainda sem ack',
      icon: 'clock',
      color: 'violet',
    },
    {
      key: 'total',
      label: 'Total na fila',
      detail: 'Prontas + não confirmadas',
      icon: 'database',
      color: 'green',
    },
    {
      key: 'deadLetterReady',
      label: 'Dead-letter',
      detail: 'Falhas isoladas para análise',
      icon: 'shield',
      color: 'amber',
    },
  ] as const;
  metric(key: 'ready' | 'unacknowledged' | 'total' | 'deadLetterReady'): number | null {
    return this.store.metrics()?.[key] ?? null;
  }
  rate(value: number | null | undefined): string {
    return value == null
      ? '—'
      : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  }
  stateLabel(op: Operation): string {
    return {
      sending: 'Enviando',
      confirmed: 'Ledger confirmado',
      projected: 'Projetado',
      rejected: 'Rejeitado',
      uncertain: 'Não confirmado',
    }[op.state];
  }
  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.store.notice('info', 'Comando copiado', 'Execute na pasta financeiro-carrefour-v2.');
    } catch {
      this.store.notice('info', 'Copie o comando manualmente', text);
    }
  }
}
