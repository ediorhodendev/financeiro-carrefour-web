import { createGateway } from './gateway.mjs';
const server = createGateway();
server.listen(Number(process.env.PORT || 4200), process.env.HOST || '0.0.0.0', () =>
  console.log('Financial frontend listening (credentials and tokens are never logged).'),
);
for (const event of ['SIGINT', 'SIGTERM'])
  process.on(event, () => server.close(() => process.exit(0)));
