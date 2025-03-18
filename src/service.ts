import type * as pg from 'pg';
import type { CopyStreamQuery } from 'pg-copy-streams';
import type { TransformOptions } from 'stream';
import * as PgCsvToJSON from './pg-csv-to-json';
import * as PgEventEngine from './pg-event-engine';
import * as PgQueryRunner from './pg-query-runner';
import * as PgUtils from './pg-utils';
import type { Constructor } from './schema';
import { getPoolConfig } from './utils';

export default class YapgClient extends PgQueryRunner.Service {
  static PgUtils = PgUtils.Service;

  static async new<T>(
    this: Constructor<T>,
    ...[config, ...rest]: Partial<ConstructorParameters<typeof YapgClient>>
  ): Promise<T> {
    return new this(await getPoolConfig(config), ...rest);
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
    const columns: [string, string][] = await this.describeStatementColumns(text);

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

    const transform: PgCsvToJSON.Service = new PgCsvToJSON.Service(text, columns, options);
    return readable.pipe(transform);
  }

  newEventEngine(...args: Parameters<typeof PgEventEngine.Service.new>): Promise<PgEventEngine.Service> {
    const [channelName, processEvent, poolOptions, pool, ...rest] = args;
    return PgEventEngine.Service.new(
      channelName,
      processEvent,
      poolOptions || this.options,
      pool || this.pool,
      ...rest,
    );
  }
}
