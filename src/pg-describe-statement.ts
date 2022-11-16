import * as pg from 'pg';
import { RowDescriptionMessage } from './schema';

export class PgDescribeStatement<V extends any[]> extends pg.Query<RowDescriptionMessage, V> {
  static statementId: number = 0;

  static get nextStatementId(): string {
    return `s${++this.statementId}`;
  }

  static async describe<V extends any[]>(
    client: pg.PoolClient,
    statement: string,
    ...values: V
  ): Promise<RowDescriptionMessage | undefined> {
    const id: string = this.nextStatementId;

    await client.query(`PREPARE ${id} AS ${statement}`, values);

    const description: RowDescriptionMessage | undefined = await new Promise((resolve, reject) => {
      client.query(new this(id, statement, resolve, reject, values));
    });

    await client.query(`DEALLOCATE ${id}`);

    return description;
  }

  constructor(
    public name: string,
    statement: string,
    public onSuccess: (data: RowDescriptionMessage) => void,
    public onError: (err: any) => void,
    ...values: V
  ) {
    super({ name, text: statement, values });
  }

  handleError(err: any): void {
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
