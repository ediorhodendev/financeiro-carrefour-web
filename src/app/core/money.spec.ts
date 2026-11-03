import { canonicalAmount, entryBody, fixedUnits, money, parseFinancialJson } from './money';
describe('financial precision', () => {
  it.each([
    ['10,1234', '10.1234'],
    ['0001.2', '1.2000'],
    ['0.0001', '0.0001'],
    ['999999999999999.9999', '999999999999999.9999'],
  ])('canonicalizes %s without floating point', (input, expected) =>
    expect(canonicalAmount(input)).toBe(expected),
  );
  it.each([
    '0',
    '-1',
    '1.12345',
    '1,000.00',
    'NaN',
    'Infinity',
    '1e2',
    '',
    '1000000000000000',
    '1.',
    '+1',
  ])('rejects invalid amount %s', (input) => expect(() => canonicalAmount(input)).toThrow());
  it('preserves the largest response amount including nested accounts', () =>
    expect(
      parseFinancialJson<{ amount: string; accounts: { amount: string }[] }>(
        '{"amount":999999999999999.9999,"accounts":[{"amount":10.1234}]}',
      ),
    ).toEqual({ amount: '999999999999999.9999', accounts: [{ amount: '10.1234' }] }));
  it('formats four significant fractional places and large integers exactly', () => {
    expect(money('999999999999999.9999')).toBe('R$ 999.999.999.999.999,9999');
    expect(money('10.1234')).toBe('R$ 10,1234');
    expect(money('70.0000')).toBe('R$ 70,00');
    expect(money(null)).toBe('—');
  });
  it('calculates using fixed point', () =>
    expect(fixedUnits('100.0000') - fixedUnits('30.1234')).toBe(698766n));
  it('serializes numeric decimal tokens and escapes text safely', () => {
    const body = entryBody('Credito', '999999999999999,9999', 'Quotation " and newline\n', 'order');
    expect(body).toContain('"valor":999999999999999.9999');
    expect(JSON.parse(body).descricao).toBe('Quotation " and newline');
  });
});
