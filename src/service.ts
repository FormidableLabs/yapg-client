import type * as pg from 'pg';
import type { CopyStreamQuery } from 'pg-copy-streams';
import type { Transform, TransformOptions } from 'stream';
import * as PgCsvToJSON from './pg-csv-to-json';
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

  async jsonStream(text: string, client?: pg.PoolClient, options?: TransformOptions): Promise<PgCsvToJSON.Service> {
    const autoConnect: boolean = !client;
    const readClient: pg.PoolClient = client || (await this.pool.connect());

    const copyQuery: string = `
      COPY (${text})
      TO STDOUT
      WITH (FORMAT CSV, ENCODING UTF8, HEADER FALSE)
    `;
    const readable: CopyStreamQuery = YapgClient.PgUtils.toReadable(copyQuery, readClient);
    readable.on('close', () => {
      if (autoConnect) readClient.release();
    });

    const columns: [string, string][] = await this.describeStatementColumns(text);
    const transform: PgCsvToJSON.Service = new PgCsvToJSON.Service(text, columns, options);
    return readable.pipe(transform);
  }
}
