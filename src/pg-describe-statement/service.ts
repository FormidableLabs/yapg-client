import * as pg from 'pg';
import type { RowDescriptionMessage } from '../schema';

export class PgDescribeStatement<V> extends pg.Query<RowDescriptionMessage, V[]> {
  static currentStatementId: number = 0;

  static get nextStatementId(): string {
    return `s${++this.currentStatementId}`;
  }

  static async describe<V>(
    text: string,
    client: pg.PoolClient,
    values?: V[],
  ): Promise<RowDescriptionMessage> {
    const statementId: string = this.nextStatementId;

    await client.query(`PREPARE ${statementId} AS ${text}`, values);

    const description: RowDescriptionMessage = await new Promise((resolve, reject) =>
      client.query(new this(statementId, text, resolve, reject, values)),
    );

    await client.query(`DEALLOCATE ${statementId}`);

    return description;
  }

  constructor(
    public name: string,
    text: string,
    public onSuccess: (data: RowDescriptionMessage) => void,
    public onError: (err: unknown) => void,
    values?: V[],
  ) {
    super({ name, text, values });
  }

  handleError(err: unknown): void {
    if (err) this.onError(err);
  }

  handleReadyForQuery(): void {}

  handleRowDescription(data: RowDescriptionMessage): void {
    this.onSuccess(data);
  }

  submit = (connection: pg.Connection): void => {
    connection.describe({ type: 'S', name: this.name }, false);
    connection.sync();
  };
}

export { PgDescribeStatement as Service };
