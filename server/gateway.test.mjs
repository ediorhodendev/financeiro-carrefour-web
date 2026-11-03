import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGateway } from './gateway.mjs';
async function setup(t, fetcher, extra = {}) {
  const server = createGateway({
    fetcher,
    ledger: 'http://ledger',
    balance: 'http://balance',
    rabbit: 'http://rabbit',
    user: 'bank',
    password: 'secret',
    ...extra,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}
const account = 'c90a3c2c-cdeb-4df0-85cb-d1a299a0d101';
test('proxy preserves raw decimal body, replay status and key', async (t) => {
  const body = '{"valor":999999999999999.9999}';
  const url = await setup(t, async (url, init) => {
    assert.equal(url, `http://ledger/api/v1/contas/${account}/lancamentos`);
    assert.equal(init.body.toString(), body);
    assert.equal(init.headers['idempotency-key'], 'same');
    assert.equal(init.headers.cookie, undefined);
    return new Response('{"amount":999999999999999.9999}', {
      status: 201,
      headers: { 'Idempotency-Replayed': 'true' },
    });
  });
  const result = await fetch(`${url}/api/ledger/api/v1/contas/${account}/lancamentos`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'same', Cookie: 'private' },
    body,
  });
  assert.equal(result.status, 201);
  assert.equal(result.headers.get('Idempotency-Replayed'), 'true');
  assert.equal(await result.text(), '{"amount":999999999999999.9999}');
});
test('metrics require bearer and upstream authorization before touching broker', async (t) => {
  let calls = 0;
  const url = await setup(t, async () => {
    calls++;
    return new Response('', { status: 403 });
  });
  assert.equal((await fetch(url + '/api/messaging')).status, 401);
  assert.equal(calls, 0);
  assert.equal(
    (await fetch(url + '/api/messaging', { headers: { Authorization: 'Bearer invalid' } })).status,
    403,
  );
  assert.equal(calls, 1);
});
test('metrics aggregate only allowlisted queue fields and keep broker credentials server-side', async (t) => {
  const seen = [];
  const url = await setup(t, async (url, init) => {
    seen.push(url);
    if (url.startsWith('http://balance')) return Response.json({ accounts: [] });
    assert.equal(
      init.headers.Authorization,
      'Basic ' + Buffer.from('bank:secret').toString('base64'),
    );
    return Response.json({
      messages_ready: url.endsWith('bank.balance.dead.v1') ? 2 : 3,
      messages_unacknowledged: 1,
      messages: 4,
      consumers: 0,
      message_stats: { deliver_get_details: { rate: 2.5 } },
      privatePayload: 'DO NOT LEAK',
    });
  });
  const result = await fetch(url + '/api/messaging', { headers: { Authorization: 'Bearer demo' } });
  const text = await result.text();
  const data = JSON.parse(text);
  assert.equal(data.ready, 3);
  assert.equal(data.deadLetterReady, 2);
  assert.equal(data.registeredConsumers, 0);
  assert.equal(data.deliveryRate, 2.5);
  assert.ok(seen.includes('http://rabbit/api/queues/%2F/bank.balance.dead.v1'));
  assert.ok(!text.includes('secret'));
  assert.ok(!text.includes('DO NOT LEAK'));
});
test('unavailable broker has unknown counters rather than simulated zero', async (t) => {
  const url = await setup(t, async (url) => {
    if (url.startsWith('http://balance')) return Response.json({});
    throw new Error('offline');
  });
  const result = await fetch(url + '/api/messaging', { headers: { Authorization: 'Bearer demo' } });
  const data = await result.json();
  assert.equal(data.available, false);
  assert.equal(data.ready, null);
});
test('gateway exposes neither arbitrary upstream requests nor queue mutation', async (t) => {
  const url = await setup(t, () => {
    throw new Error('must not call upstream');
  });
  assert.equal((await fetch(url + '/api/ledger/admin')).status, 404);
  assert.equal((await fetch(url + '/api/messaging', { method: 'DELETE' })).status, 404);
  assert.equal((await fetch(url + '/api/balance/demo/access', { method: 'POST' })).status, 404);
});
test('oversized bodies are rejected without forwarding', async (t) => {
  const url = await setup(t, () => {
    throw new Error('must not call upstream');
  });
  assert.equal(
    (
      await fetch(`${url}/api/ledger/api/v1/contas/${account}/lancamentos`, {
        method: 'POST',
        body: 'x'.repeat(65537),
      })
    ).status,
    413,
  );
});
test('upstream failures remain uncertain and are not automatically retried', async (t) => {
  let calls = 0;
  const url = await setup(t, async () => {
    calls++;
    throw new Error('timeout');
  });
  assert.equal((await fetch(url + '/api/ledger/demo/access', { method: 'POST' })).status, 502);
  assert.equal(calls, 1);
});
