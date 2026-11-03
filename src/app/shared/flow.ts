import { Component, inject } from '@angular/core';
import { BankStore } from '../core/bank-store';
import { Icon } from './icon';
@Component({
  selector: 'app-flow',
  imports: [Icon],
  template: ` <div class="flow-steps">
    <div class="flow-step" [class.complete]="!!store.latest()?.entry">
      <span class="step-icon"><app-icon name="shield" /></span><b>Ledger</b
      ><small>{{ store.latest()?.entry ? 'Gravação confirmada' : 'Recebe a operação' }}</small
      ><span class="step-tag">Transação ACID</span>
    </div>
    <span class="flow-link"><app-icon name="arrow" /></span>
    <div class="flow-step" [class.complete]="!!store.latest()?.entry">
      <span class="step-icon"><app-icon name="database" /></span><b>Outbox</b
      ><small>Evento junto ao lançamento</small><span class="step-tag">Mesmo commit</span>
    </div>
    <span class="flow-link"><app-icon name="arrow" /></span>
    <div class="flow-step" [class.complete]="store.metrics()?.available">
      <span class="step-icon"><app-icon name="queue" /></span><b>RabbitMQ</b
      ><small>{{
        store.metrics()?.available
          ? (store.metrics()?.ready ?? 0) + ' prontas na fila global'
          : 'Métricas indisponíveis'
      }}</small
      ><span class="step-tag">Entrega assíncrona</span>
    </div>
    <span class="flow-link"><app-icon name="arrow" /></span>
    <div class="flow-step" [class.complete]="store.latest()?.state === 'projected'">
      <span class="step-icon"><app-icon name="check" /></span><b>Balance</b
      ><small>{{
        store.latest()?.state === 'projected'
          ? 'Sequência incorporada'
          : 'Worker atualiza a leitura'
      }}</small
      ><span class="step-tag">Inbox idempotente</span>
    </div>
  </div>`,
  styles: '',
})
export class Flow {
  readonly store = inject(BankStore);
}
