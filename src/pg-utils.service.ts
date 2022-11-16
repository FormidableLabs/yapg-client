import * as pg from 'pg';
import { PgDescribeStatement } from './pg-describe-statement';
import { PgUtilsConfig, RowDescriptionMessage } from './schema';

export class PgUtils {
  static async getConfig(options?: Partial<PgUtilsConfig>): Promise<PgUtilsConfig> {
    const { pool }: Partial<PgUtilsConfig> = options || {};

    const {
      database = process.env.PGDATABASE || 'postgres',
      host = process.env.PGHOST || 'localhost',
      password = process.env.PGPASSWORD || 'postgres',
      port = +(process.env.PGPORT || 5432),
      user = process.env.PGUSERNAME || 'postgres',
    }: Partial<pg.PoolConfig> = pool || {};

    return {
      pool: { ...pool, database, host, password, port, user },
    };
  }

  static async new(...[config, ...rest]: Partial<ConstructorParameters<typeof PgUtils>>): Promise<PgUtils> {
    return new this(await this.getConfig(config), ...rest);
  }

  pool: pg.Pool;

  constructor(public config: PgUtilsConfig) {
    this.pool = new pg.Pool({ ...config.pool, allowExitOnIdle: true });
  }

  async getStatementFields<V extends any[]>(
    statement: string,
    client?: pg.PoolClient,
    ...values: V
  ): Promise<[string, string][]> {
    const autoConnect: boolean = !client;
    const resolvedClient: pg.PoolClient = client || (await this.pool.connect());

    try {
      const description: RowDescriptionMessage | undefined = await PgDescribeStatement.describe(
        resolvedClient,
        statement,
        ...values,
      );

      if (!description) return [];

      const columns: string[] = [];
      for (const { dataTypeID, dataTypeModifier } of description.fields)
        columns.push(`FORMAT_TYPE(${dataTypeID}, ${dataTypeModifier})`);

      const { rows: [row] = [] }: pg.QueryArrayResult<string[]> = await resolvedClient.query({
        text: `SELECT ${columns.join()}`,
        rowMode: 'array',
      });

      const statementFields: [string, string][] = [];
      for (const [index, type] of row.entries()) statementFields.push([description.fields[index].name, type]);
      return statementFields;
    } finally {
      if (autoConnect) resolvedClient.release();
    }
  }
}
