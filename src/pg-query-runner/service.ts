import * as pg from 'pg';
import type { Consumable } from '../schema';

export class PgQueryRunner {
  pool: pg.Pool;

  constructor(public options: Partial<pg.PoolConfig>) {
    this.pool = new pg.Pool({ ...options, allowExitOnIdle: true });
  }

  static async savepoint<R>(
    transaction: (client: pg.PoolClient) => Promise<R>,
    client: pg.PoolClient,
    savepoint: string = 'A',
  ): Promise<R> {
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      const result: R = await transaction(client);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  async query<R, V>(text: string, values?: V[], client?: pg.PoolClient): Promise<R[]> {
    return (await this.queries<R, V>([{ text, values }], client))[0];
  }

  async queries<R, V>(queries: Consumable<{ text: string; values?: V[] }>, client?: pg.PoolClient): Promise<R[][]> {
    const autoConnect: boolean = !client;
    client ||= await this.pool.connect();

    try {
      const results: R[][] = [];
      for await (const { text, values } of typeof queries === 'function' ? queries() : queries)
        results.push((await client.query(text, values)).rows);
      return results;
    } finally {
      if (autoConnect) client.release();
    }
  }

  async transaction<R>(transaction: (client: pg.PoolClient) => Promise<R>, client?: pg.PoolClient): Promise<R> {
    const autoConnect: boolean = !client;
    client ||= await this.pool.connect();

    try {
      if (autoConnect) await client.query('BEGIN');
      const result: R = await transaction(client);
      if (autoConnect) await client.query('COMMIT');
      return result;
    } catch (error) {
      if (autoConnect) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (autoConnect) client.release();
    }
  }
}

export { PgQueryRunner as Service };
