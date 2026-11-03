import { ModalFocus } from './shared/modal-focus';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BankStore } from './core/bank-store';
import { Icon } from './shared/icon';
@Component({
  selector: 'app-root',
  imports: [ModalFocus, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly store = inject(BankStore);
  readonly connectionOpen = signal(false);
  readonly mobileOpen = signal(false);
  token = '';
  account = '';
  manual = false;
  accountInput = '';
  readonly nav = [
    { path: '/', exact: true, icon: 'grid', label: 'Visão geral' },
    { path: '/movimentacoes', exact: false, icon: 'arrows', label: 'Movimentações' },
    { path: '/mensageria', exact: false, icon: 'queue', label: 'Mensageria' },
    { path: '/guia', exact: false, icon: 'book', label: 'Como testar' },
  ];
  async connect(): Promise<void> {
    if (this.manual) {
      if (await this.store.connectToken(this.token, this.account)) {
        this.connectionOpen.set(false);
        this.token = '';
      }
    } else {
      await this.store.connectDemo();
      if (this.store.session.connected()) this.connectionOpen.set(false);
    }
  }
  selectAccount(): void {
    if (/^[0-9a-f-]{36}$/i.test(this.accountInput)) {
      this.store.selectAccount(this.accountInput);
      this.accountInput = '';
    } else this.store.notice('error', 'Conta inválida', 'Informe o UUID completo da conta.');
  }
}
