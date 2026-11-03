import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const uuid = '[0-9a-fA-F-]{36}';
const allowed = [
  ['POST', /^\/demo\/access$/],
  ['POST', /^\/api\/v1\/contas$/],
  ['POST', new RegExp(`^/api/v1/contas/${uuid}/lancamentos(?:/${uuid}/estorno)?$`)],
];
const readAllowed = new RegExp(`^/api/v1/(?:contas/${uuid}/(?:saldo|extrato)|clientes/me/saldo)$`);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const unknownMetrics = (message) => ({
  available: false,
  observedAt: new Date().toISOString(),
  ready: null,
  unacknowledged: null,
  total: null,
  deadLetterReady: null,
  registeredConsumers: null,
  publishRate: null,
  deliveryRate: null,
  ackRate: null,
  message,
});
export function createGateway(options = {}) {
  const config = {
    ledger: process.env.LEDGER_URL || 'http://127.0.0.1:5081',
    balance: process.env.BALANCE_URL || 'http://127.0.0.1:5082',
    rabbit: process.env.RABBITMQ_URL || 'http://127.0.0.1:15673',
    user: process.env.RABBITMQ_USER || '',
    password: process.env.RABBITMQ_PASSWORD || '',
    root: resolve('dist/financeiro-carrefour-web/browser'),
    mode: 'live',
    timeout: 12000,
    ...options,
  };
  for (const target of [config.ledger, config.balance, config.rabbit]) {
    const u = new URL(target);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash)
      throw new Error('Invalid upstream URL');
  }
  const fetcher = options.fetcher || fetch;
  const upstream = (url, init = {}) =>
    fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(config.timeout) });
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
  };
  const problem = (res, status, detail) =>
    json(res, status, { type: 'about:blank', title: 'Solicitação não concluída', status, detail });
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url, 'http://gateway');
      const path = url.pathname;
      if (path === '/health/live' && req.method === 'GET') return json(res, 200, { status: 'ok' });
      if (path === '/api/config' && req.method === 'GET')
        return json(res, 200, {
          mode: config.mode,
          metricsEnabled: !!(config.user && config.password),
        });
      if (path === '/api/status' && req.method === 'GET') {
        const health = await Promise.all(
          [config.ledger, config.balance].map(async (base) => {
            try {
              return (await upstream(base + '/health/ready')).ok;
            } catch {
              return false;
            }
          }),
        );
        return json(res, 200, {
          ledger: health[0],
          balance: health[1],
          observedAt: new Date().toISOString(),
        });
      }
      if (path === '/api/messaging' && req.method === 'GET') {
        if (!/^Bearer .{1,16000}$/.test(req.headers.authorization || ''))
          return problem(res, 401, 'Autenticação necessária.');
        const authorized = await upstream(config.balance + '/api/v1/clientes/me/saldo', {
          headers: { Authorization: req.headers.authorization },
        });
        if (!authorized.ok)
          return problem(
            res,
            [401, 403].includes(authorized.status) ? authorized.status : 503,
            'Não foi possível autorizar a consulta de métricas.',
          );
        await authorized.body?.cancel();
        if (!config.user || !config.password)
          return json(
            res,
            200,
            unknownMetrics('Configure as credenciais RabbitMQ no servidor do frontend.'),
          );
        try {
          const headers = {
            Authorization:
              'Basic ' + Buffer.from(config.user + ':' + config.password).toString('base64'),
          };
          const names = ['bank.balance.v1', 'bank.balance.dead.v1'];
          const responses = await Promise.all(
            names.map((name) => upstream(config.rabbit + '/api/queues/%2F/' + name, { headers })),
          );
          if (responses.some((r) => !r.ok)) {
            for (const r of responses) await r.body?.cancel();
            return json(
              res,
              200,
              unknownMetrics(
                'Broker indisponível, credenciais inválidas ou filas ainda não criadas.',
              ),
            );
          }
          const [queue, dead] = await Promise.all(responses.map((r) => r.json()));
          const rate = (key) =>
            Number.isFinite(queue.message_stats?.[key]?.rate)
              ? queue.message_stats[key].rate
              : null;
          return json(res, 200, {
            available: true,
            observedAt: new Date().toISOString(),
            ready: queue.messages_ready ?? 0,
            unacknowledged: queue.messages_unacknowledged ?? 0,
            total: queue.messages ?? 0,
            deadLetterReady: dead.messages_ready ?? 0,
            registeredConsumers: queue.consumers ?? 0,
            publishRate: rate('publish_details'),
            deliveryRate: rate('deliver_get_details'),
            ackRate: rate('ack_details'),
          });
        } catch {
          return json(
            res,
            200,
            unknownMetrics('Sem comunicação com o RabbitMQ. Os dados não foram estimados.'),
          );
        }
      }
      const match = path.match(/^\/api\/(ledger|balance)(\/.*)$/);
      if (match) {
        const [, service, suffix] = match;
        const permitted =
          service === 'ledger'
            ? allowed.some(([method, re]) => req.method === method && re.test(suffix))
            : req.method === 'GET' && readAllowed.test(suffix);
        if (!permitted) return problem(res, 404, 'Rota não exposta pelo gateway.');
        if (Number(req.headers['content-length'] || 0) > 65536)
          return problem(res, 413, 'Corpo excede 64 KiB.');
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536) return problem(res, 413, 'Corpo excede 64 KiB.');
          chunks.push(chunk);
        }
        const headers = {};
        for (const name of ['authorization', 'content-type', 'idempotency-key'])
          if (req.headers[name]) headers[name] = req.headers[name];
        const response = await upstream(config[service] + suffix + url.search, {
          method: req.method,
          headers,
          body: size ? Buffer.concat(chunks) : undefined,
        });
        for (const name of [
          'content-type',
          'retry-after',
          'idempotency-replayed',
          'x-correlation-id',
        ])
          if (response.headers.has(name)) res.setHeader(name, response.headers.get(name));
        res.writeHead(response.status);
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if (path.startsWith('/api/')) return problem(res, 404, 'Rota inexistente.');
      if (!['GET', 'HEAD'].includes(req.method)) return problem(res, 405, 'Método não permitido.');
      let decoded;
      try {
        decoded = decodeURIComponent(path);
      } catch {
        return problem(res, 400, 'Caminho inválido.');
      }
      const file = resolve(config.root, '.' + decoded);
      if (file !== config.root && !file.startsWith(config.root + sep))
        return problem(res, 400, 'Caminho inválido.');
      let target = file;
      try {
        if (!(await stat(target)).isFile()) target = resolve(config.root, 'index.html');
      } catch {
        if (extname(decoded)) return problem(res, 404, 'Arquivo inexistente.');
        target = resolve(config.root, 'index.html');
      }
      const data = await readFile(target);
      res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      if (!res.headersSent)
        problem(
          res,
          502,
          'Serviço indisponível ou resposta não confirmada. Repita operações financeiras com a mesma Idempotency-Key.',
        );
      else res.end();
    }
  });
}
