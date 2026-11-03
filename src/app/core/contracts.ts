export interface DemoAccess {
  accountId: string;
  token: string;
  expiresInSeconds: number;
}
export interface Account {
  id: string;
  openedAt: string;
  currency: string;
}
export interface Balance {
  accountId: string;
  currency: string;
  amount: string;
  at: string | null;
  lastSequence: number;
  processedAt: string;
}
export interface Entry {
  id: string;
  accountId?: string;
  sequence: number;
  type: 1 | 2;
  amount: string;
  registeredAt: string;
  reversalOf: string | null;
}
export interface Statement {
  items: Entry[];
  page: number;
  size: number;
  total: number;
  lastSequence: number;
}
export interface Consolidated {
  customerId: string;
  currency: string;
  amount: string;
  at: string | null;
  accounts: Balance[];
}
export interface QueueMetrics {
  available: boolean;
  observedAt: string;
  ready: number | null;
  unacknowledged: number | null;
  total: number | null;
  deadLetterReady: number | null;
  registeredConsumers: number | null;
  publishRate: number | null;
  deliveryRate: number | null;
  ackRate: number | null;
  message?: string;
}
export interface SystemStatus {
  ledger: boolean;
  balance: boolean;
  observedAt: string;
}
export interface RuntimeConfig {
  mode: 'live' | 'preview';
  metricsEnabled: boolean;
}
export type OperationState = 'sending' | 'confirmed' | 'projected' | 'rejected' | 'uncertain';
export interface Operation {
  key: string;
  accountId: string;
  path: string;
  body: string;
  kind: 'credit' | 'debit' | 'reversal';
  state: OperationState;
  startedAt: string;
  entry?: Entry;
  replayed?: boolean;
  error?: string;
  httpStatus?: number;
}
export interface Notice {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  detail: string;
}
