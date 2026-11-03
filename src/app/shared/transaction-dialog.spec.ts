import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TransactionDialog } from './transaction-dialog';
import { BankStore } from '../core/bank-store';
import { Operation } from '../core/contracts';
describe('transaction intention lifecycle', () => {
  const account = 'c90a3c2c-cdeb-4df0-85cb-d1a299a0d101';
  function setup() {
    const submit = vi
      .fn<(op: Operation) => Promise<Operation>>()
      .mockImplementation(async (op) => ({ ...op, state: 'uncertain', error: 'timeout' }));
    TestBed.configureTestingModule({
      imports: [TransactionDialog],
      providers: [
        {
          provide: BankStore,
          useValue: {
            accountId: signal(account),
            session: { connected: signal(true) },
            submit,
            notice: vi.fn(),
          },
        },
      ],
    });
    return { fixture: TestBed.createComponent(TransactionDialog), submit };
  }
  it('keeps the same body, path and key after a lost response', async () => {
    const { fixture, submit } = setup();
    const component = fixture.componentInstance;
    component.amount = '10,1234';
    component.description = 'Deposit';
    await component.send();
    const first = submit.mock.calls[0][0];
    component.amount = '99';
    component.description = 'Changed by accidental editing';
    await component.send();
    const second = submit.mock.calls[1][0];
    expect(second.body).toBe(first.body);
    expect(second.key).toBe(first.key);
    expect(second.path).toBe(first.path);
    expect(component.locked()).toBe(true);
  });
  it('sends a reversal with only the reason and original entry path', async () => {
    const { fixture, submit } = setup();
    fixture.componentRef.setInput('original', {
      id: '11111111-1111-1111-1111-111111111111',
      sequence: 1,
      type: 2,
      amount: '30.0000',
      registeredAt: new Date().toISOString(),
      reversalOf: null,
    });
    fixture.componentInstance.description = 'Cancellation';
    await fixture.componentInstance.send();
    const op = submit.mock.calls[0][0];
    expect(op.body).toBe('{"motivo":"Cancellation"}');
    expect(op.path).toContain('/11111111-1111-1111-1111-111111111111/estorno');
    expect(op.kind).toBe('reversal');
  });
  it('rejects invalid precision without an HTTP request', async () => {
    const { fixture, submit } = setup();
    fixture.componentInstance.amount = '10.12345';
    fixture.componentInstance.description = 'Deposit';
    await fixture.componentInstance.send();
    expect(submit).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('4 casas');
  });
});
