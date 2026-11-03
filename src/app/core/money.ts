/** Fixed-point arithmetic: financial values never pass through Number/parseFloat. */
const SCALE = 10000n;
const MAX = 9999999999999999999n;
export function canonicalAmount(input: string): string {
  const value = input.trim();
  if (!/^\d{1,15}([.,]\d{1,4})?$/.test(value))
    throw new Error('Use um valor positivo, sem separador de milhar, com até 4 casas decimais.');
  const [whole, fractional = ''] = value.replace(',', '.').split('.');
  const units = BigInt(whole) * SCALE + BigInt(fractional.padEnd(4, '0'));
  if (units <= 0n || units > MAX)
    throw new Error('O valor deve ser maior que zero e respeitar o limite da conta.');
  return `${units / SCALE}.${(units % SCALE).toString().padStart(4, '0')}`;
}
export function fixedUnits(value: string): bigint {
  if (!/^-?\d+(\.\d{1,4})?$/.test(value)) throw new Error('Formato monetário inesperado.');
  const negative = value.startsWith('-');
  const [whole, part = ''] = value.replace('-', '').split('.');
  const units = BigInt(whole) * SCALE + BigInt(part.padEnd(4, '0'));
  return negative ? -units : units;
}
export function money(value: string | null | undefined, precise = false): string {
  if (value == null) return '—';
  const units = fixedUnits(value);
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const fraction = (absolute % SCALE).toString().padStart(4, '0');
  const digits = precise || fraction.slice(2) !== '00' ? 4 : 2;
  const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(
    absolute / SCALE,
  );
  return `${negative ? '−' : ''}R$ ${integer},${fraction.slice(0, digits)}`;
}
export function entryBody(
  kind: 'Credito' | 'Debito',
  amount: string,
  description: string,
  reference: string,
): string {
  const value = canonicalAmount(amount);
  const text = description.trim();
  if (!text || text.length > 500) throw new Error('Informe uma descrição de até 500 caracteres.');
  if (reference.length > 128) throw new Error('A referência deve ter até 128 caracteres.');
  return `{"tipo":${JSON.stringify(kind)},"valor":${value},"descricao":${JSON.stringify(text)}${reference.trim() ? `,"referenciaExterna":${JSON.stringify(reference.trim())}` : ''}}`;
}
export function parseFinancialJson<T>(text: string): T {
  // The v2 contract contains monetary amounts in fields named "amount".
  // Quote their numeric tokens before JSON.parse can round NUMERIC(19,4).
  return JSON.parse(text.replace(/("amount"\s*:\s*)(-?\d+(?:\.\d+)?)(?=\s*[,}])/g, '$1"$2"')) as T;
}
