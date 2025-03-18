import { ok } from 'assert';
import { randomBytes } from 'crypto';
import pg from 'pg';
import pgFormat from 'pg-format';
import YapgClient from '../../src';

export class Demo {
  static get channelName(): string {
    return 'demo_events';
  }

  static async insertNewEvents(client: pg.PoolClient): Promise<void> {
    const externalId: string = randomBytes(10).toString('hex');
    const query: string = pgFormat(
      'INSERT INTO %1$I ("externalId") VALUES (%2$L)',
      ...[Demo.channelName, externalId],
    );
    const copies: number = Math.trunc(Math.random() * 5 + 1);
    const queries: string = Array(copies).fill(query).join(';');
    await client.query(queries);
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 3000 + 500));
  }

  static async processEvent(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 15000 + 2000));
    if (Math.random() < 0.1) throw new Error('Simulated error');
  }
}

if (require.main === module)
  (async () => {
    const yapgClient: YapgClient = await YapgClient.new();
    const engine = await yapgClient.newEventEngine(Demo.channelName, Demo.processEvent);
    const eventClient: pg.PoolClient = await engine.pool.connect();
    while (true) await Demo.insertNewEvents(eventClient);
  })();
