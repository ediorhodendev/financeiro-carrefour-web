import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Entry } from '../core/contracts';
import { money } from '../core/money';
import { Icon } from './icon';
@Component({
  selector: 'app-entries',
  imports: [DatePipe, Icon],
  template: ` <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Operação</th>
          <th>Data e hora <span class="muted">(UTC)</span></th>
          <th>Sequência</th>
          <th class="align-right">Valor</th>
          <th class="align-right">Ação</th>
        </tr>
      </thead>
      <tbody>
        @for (entry of entries(); track entry.id) {
          <tr>
            <td>
              <div class="entry-type">
                <span class="entry-icon" [class.debit]="entry.type === 2"
                  ><app-icon [name]="entry.reversalOf ? 'undo' : entry.type === 1 ? 'down' : 'up'"
                /></span>
                <div>
                  <strong>{{
                    entry.reversalOf ? 'Estorno' : entry.type === 1 ? 'Crédito' : 'Débito'
                  }}</strong
                  ><small class="mono" [title]="entry.id"
                    >{{ entry.id.slice(0, 8) }}…{{ entry.id.slice(-4) }}</small
                  >
                </div>
              </div>
            </td>
            <td>
              {{ entry.registeredAt | date: 'dd MMM yyyy' : 'UTC'
              }}<small class="cell-sub">{{ entry.registeredAt | date: 'HH:mm:ss' : 'UTC' }}</small>
            </td>
            <td>
              <span class="sequence">#{{ entry.sequence }}</span>
            </td>
            <td class="align-right amount" [class.positive]="entry.type === 1">
              {{ entry.type === 1 ? '+' : '−' }} {{ money(entry.amount) }}
            </td>
            <td class="align-right">
              @if (!entry.reversalOf && !isReversed(entry.id)) {
                <button
                  class="text-button table-action"
                  [disabled]="disabled()"
                  (click)="reverse.emit(entry)"
                >
                  <app-icon name="undo" />Estornar
                </button>
              } @else {
                <span class="muted small">{{
                  entry.reversalOf ? 'Compensatório' : 'Estornado'
                }}</span>
              }
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="5">
              <div class="empty-state">
                <app-icon name="arrows" />
                <h3>Nenhuma movimentação para exibir</h3>
                <p>Conecte uma conta e registre o primeiro lançamento.</p>
              </div>
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>`,
  styles: '',
})
export class Entries {
  readonly entries = input<Entry[]>([]);
  readonly disabled = input(false);
  readonly reverse = output<Entry>();
  readonly money = money;
  isReversed(id: string): boolean {
    return this.entries().some((e) => e.reversalOf === id);
  }
}
