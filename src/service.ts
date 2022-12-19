import type * as pg from 'pg';
import * as PgQueryRunner from './pg-query-runner';
import * as PgUtils from './pg-utils';
import type { Constructor } from './schema';

export default class YapgClient extends PgQueryRunner.Service {
  static PgUtils = PgUtils.Service;

  static async getConfig(options?: Partial<pg.PoolConfig>): Promise<Partial<pg.PoolConfig>> {
    const {
      database = process.env.PGDATABASE || 'postgres',
      host = process.env.PGHOST || 'localhost',
      password = process.env.PGPASSWORD || 'postgres',
      port = +(process.env.PGPORT || 5432),
      user = process.env.PGUSERNAME || 'postgres',
    }: Partial<pg.PoolConfig> = options || {};

    return { ...options, database, host, password, port, user };
  }

  static async new<T>(
    this: Constructor<T>,
    ...[config, ...rest]: Partial<ConstructorParameters<typeof YapgClient>>
  ): Promise<T> {
    return new this(await YapgClient.getConfig(config), ...rest);
  }

  async describeStatementColumns<V>(text: string, values?: V[], client?: pg.PoolClient): Promise<[string, string][]> {
    const autoConnect: boolean = !client;
    client ||= await this.pool.connect();

    try {
      return await PgUtils.Service.describeStatementColumns(text, client, values);
    } finally {
      if (autoConnect) client.release();
    }
  }
}
