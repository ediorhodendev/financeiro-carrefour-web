import { createIdempotencyKey } from '../core/idempotency';
import { ModalFocus } from './modal-focus';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BankStore } from '../core/bank-store';
import { Entry, Operation } from '../core/contracts';
import { entryBody, money, canonicalAmount } from '../core/money';
import { Icon } from './icon';
@Component({
  selector: 'app-transaction-dialog',
  imports: [ModalFocus, FormsModule, Icon],
  template: ` <div class="modal-backdrop" (click)="close()">
    <section
      class="modal transaction-modal"
      appModalFocus
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-title"
      (click)="$event.stopPropagation()"
      (keydown.escape)="close()"
    >
      <div class="modal-header">
        <span class="square-icon"><app-icon [name]="original() ? 'undo' : 'arrows'" /></span
        ><button
          class="icon-button"
          aria-label="Fechar operação"
          [disabled]="busy()"
          (click)="close()"
        >
          <app-icon name="close" />
        </button>
      </div>
      <h2 id="transaction-title">{{ original() ? 'Estornar lançamento' : 'Nova movimentação' }}</h2>
      <p class="muted">
        {{
          original()
            ? 'O original será preservado. Um lançamento de valor integral e direção oposta será criado.'
            : 'Registre um crédito ou débito com proteção contra duplicidade.'
        }}
      </p>
      @if (original(); as entry) {
        <div class="reversal-summary">
          <span
            >{{ entry.type === 1 ? 'Crédito original' : 'Débito original' }} · #{{
              entry.sequence
            }}</span
          ><strong>{{ money(entry.amount, true) }}</strong
          ><small class="mono">{{ entry.id }}</small>
        </div>
        <div class="info-box">
          <app-icon name="shield" />
          <p>
            Somente um estorno por original. Um estorno não pode ser estornado. Se gerar débito, o
            saldo autoritativo deve ser suficiente.
          </p>
        </div>
      } @else {
        <div class="tabs operation-tabs">
          <button
            [class.selected]="kind === 'Credito'"
            [disabled]="locked()"
            (click)="kind = 'Credito'"
          >
            <app-icon name="down" />Crédito <small>Entrada</small></button
          ><button
            [class.selected]="kind === 'Debito'"
            [disabled]="locked()"
            (click)="kind = 'Debito'"
          >
            <app-icon name="up" />Débito <small>Saída</small>
          </button>
        </div>
        <label
          >Valor (BRL)
          <div class="amount-input">
            <span>R$</span
            ><input
              aria-label="Valor (BRL)"
              [(ngModel)]="amount"
              [disabled]="locked()"
              inputmode="decimal"
              autocomplete="off"
              placeholder="0,0000"
            />
          </div>
          <small>Até 4 casas decimais. Não use separador de milhar.</small></label
        >
      }
      <label
        >{{ original() ? 'Motivo do estorno' : 'Descrição'
        }}<textarea
          [(ngModel)]="description"
          [disabled]="locked()"
          rows="2"
          maxlength="500"
          [placeholder]="original() ? 'Ex.: Cancelamento da operação' : 'Ex.: Depósito para teste'"
        ></textarea>
      </label>
      @if (!original()) {
        <label
          >Referência externa <span class="muted">(opcional)</span
          ><input
            [(ngModel)]="reference"
            [disabled]="locked()"
            maxlength="128"
            placeholder="Ex.: pedido-2026-001"
        /></label>
      }
      <details class="idempotency-detail">
        <summary>
          <app-icon name="shield" />Proteção de idempotência <app-icon name="down" />
        </summary>
        <p>
          A mesma intenção usa a mesma chave e o mesmo corpo. A API conserva o resultado por 48
          horas.
        </p>
        <code class="key-display">{{ key }}</code
        ><button class="text-button" (click)="copyKey()">
          <app-icon name="copy" />Copiar chave
        </button>
      </details>
      @if (error()) {
        <div class="inline-error" role="alert">{{ error() }}</div>
      }
      @if (result()?.state === 'uncertain') {
        <div class="info-box">
          <app-icon name="clock" />
          <p>
            Resposta não confirmada. Os dados foram preservados. Repita a mesma intenção para
            consultar ou concluir o resultado sem duplicar.
          </p>
        </div>
      }
      @if (result()?.entry) {
        <div class="success-box">
          <app-icon name="check" />
          <div>
            <b>Operação confirmada · HTTP {{ result()?.httpStatus }}</b
            ><span
              >Sequência #{{ result()?.entry?.sequence }} ·
              {{
                result()?.replayed
                  ? 'Resposta original recuperada'
                  : 'Aguardando atualização da leitura'
              }}</span
            >
          </div>
        </div>
        <button class="button primary full" (click)="dismiss.emit()">Concluir</button>
      } @else {
        <button
          class="button primary full"
          [disabled]="busy() || !store.session.connected() || result()?.state === 'rejected'"
          (click)="send()"
        >
          {{
            busy()
              ? 'Enviando…'
              : result()?.state === 'uncertain'
                ? 'Repetir a mesma intenção'
                : original()
                  ? 'Confirmar estorno integral'
                  : 'Confirmar movimentação'
          }}<app-icon name="arrow" />
        </button>
        @if (result()?.state === 'rejected') {
          <button class="text-button full" (click)="reset()">
            Corrigir dados e gerar nova chave
          </button>
        }
      }
    </section>
  </div>`,
  styles: '',
})
export class TransactionDialog {
  readonly store = inject(BankStore);
  readonly original = input<Entry | null>(null);
  readonly dismiss = output<void>();
  readonly busy = signal(false);
  readonly result = signal<Operation | null>(null);
  readonly error = signal('');
  kind: 'Credito' | 'Debito' = 'Credito';
  amount = '';
  description = '';
  reference = '';
  key = createIdempotencyKey();
  readonly money = money;
  locked(): boolean {
    return this.busy() || !!this.result();
  }
  close(): void {
    if (!this.busy()) this.dismiss.emit();
  }
  reset(): void {
    this.result.set(null);
    this.error.set('');
    this.key = createIdempotencyKey();
  }
  async copyKey(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.key);
      this.store.notice('info', 'Chave copiada', 'Use a mesma chave somente para o mesmo corpo.');
    } catch {
      this.store.notice('info', 'Copie a chave manualmente', this.key);
    }
  }
  async send(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    try {
      let operation = this.result();
      if (!operation) {
        const description = this.description.trim();
        if (!description || description.length > 500)
          throw new Error('Informe uma descrição entre 1 e 500 caracteres.');
        if (!this.original()) canonicalAmount(this.amount);
        const accountId = this.store.accountId();
        if (!accountId) throw new Error('Selecione uma conta.');
        operation = {
          key: this.key,
          accountId,
          path:
            `/api/ledger/api/v1/contas/${accountId}/lancamentos` +
            (this.original() ? `/${this.original()!.id}/estorno` : ''),
          body: this.original()
            ? JSON.stringify({ motivo: description })
            : entryBody(this.kind, this.amount, description, this.reference),
          kind: this.original() ? 'reversal' : this.kind === 'Credito' ? 'credit' : 'debit',
          state: 'sending',
          startedAt: new Date().toISOString(),
        };
      }
      this.busy.set(true);
      const result = await this.store.submit(operation);
      this.result.set(result);
      if (result.error) this.error.set(result.error);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Verifique os campos.');
    } finally {
      this.busy.set(false);
    }
  }
}
