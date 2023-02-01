import type * as pg from 'pg';
import type { TransformOptions } from 'stream';
import pgCopyStreams, { type CopyStreamQuery, type CopyToStreamQuery } from 'pg-copy-streams';
import * as PgDescribeStatement from '../pg-describe-statement';
import type { RowDescriptionMessage } from '../schema';

export class PgUtils {
  static async describeStatementColumns<V>(
    text: string,
    client: pg.PoolClient,
    values?: V[],
  ): Promise<[string, string][]> {
    const { fields }: RowDescriptionMessage = await PgDescribeStatement.Service.describe(text, client, values);

    const columnFormats: string[] = [];
    for (const { dataTypeID, dataTypeModifier } of fields)
      columnFormats.push(`FORMAT_TYPE(${dataTypeID},${dataTypeModifier})`);

    const { rows: [row] = [] }: pg.QueryArrayResult<string[]> = await client.query({
      text: `SELECT ${columnFormats.join()}`,
      rowMode: 'array',
    });

    const statementColumns: [string, string][] = [];
    for (const [index, type] of row.entries()) statementColumns.push([fields[index].name, type]);
    return statementColumns;
  }

  static toReadable(text: string, client: pg.PoolClient, options?: TransformOptions): CopyToStreamQuery {
    return client.query(pgCopyStreams.to(text, { ...options, emitClose: true }));
  }

  static toWritable(text: string, client: pg.PoolClient, options?: TransformOptions): CopyStreamQuery {
    return client.query(pgCopyStreams.from(text, { ...options, emitClose: true }));
  }
}

export { PgUtils as Service };
