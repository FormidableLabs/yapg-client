import { randomUUID } from 'crypto';
import pg from 'pg';
import { Constructor } from '../schema';
import { getPoolConfig } from '../utils';
import * as Queries from './queries';
import { type PostgresEvent, PostgresEventStatus } from './schema';

const SQL_STATE_RECORD_LOCK: string = '55P03';

export class PgEventEngine {
  static MAX_CONCURRENCY: number = 8;

  static async new<T extends PgEventEngine>(
    this: Constructor<T>,
    channelName: string,
    processEvent: (_event: PostgresEvent, _client: pg.PoolClient) => Promise<void>,
    poolOptions?: pg.PoolConfig,
    pool?: pg.Pool,
    listenClient?: pg.PoolClient,
    tableName: string = channelName,
    maxConcurrency = PgEventEngine.MAX_CONCURRENCY,
    eventType: string | null = null,
  ): Promise<T> {
    poolOptions = await getPoolConfig(poolOptions);
    pool ??= new pg.Pool(poolOptions);
    listenClient ??= await pool.connect();
    return new this(
      ...[channelName, processEvent, poolOptions, pool, listenClient, tableName, maxConcurrency, eventType],
    ).listen();
  }

  constructor(
    public channelName: string,
    public processEvent: (_event: PostgresEvent, _client: pg.PoolClient) => Promise<void>,
    public poolOptions: pg.PoolConfig,
    public pool: pg.Pool,
    public listenClient: pg.PoolClient,
    public tableName: string,
    public maxConcurrency: number,
    public eventType: string | null,
  ) {
    this.listenClient.on('error', (err: Error): never => this.onError(err));
    this.listenClient.on('notification', (message: pg.Notification): void => {
      this.onNotification(message).catch(this.onError);
    });
    process.once('SIGTERM', () => this.onExit());
  }

  async listen(): Promise<this> {
    try {
      await this.listenClient.query(Queries.listenToChannel(this.channelName));
      for (let index: number = 0; index < this.maxConcurrency; index++)
        await this.listenClient.query(Queries.notifyChannel(this.channelName));
    } catch (err: any) {
      this.onError(err);
    }
    return this;
  }

  onError(err: Error): never {
    console.error(`Error thrown by client: ${err}`);
    process.exitCode = 1;
    process.exit(process.exitCode);
  }

  onExit(): void {
    this.listenClient.release();
  }

  async onNotification(_message: pg.Notification): Promise<void> {
    while (await this.processNewEvents());
  }

  async processNewEvents(): Promise<boolean> {
    let newEventsFound: boolean = false;
    const client: pg.PoolClient = await this.pool.connect();
    try {
      let nextId: number | null = null;
      do {
        nextId = await this.processNextNewEvent(client, randomUUID(), nextId ?? 0);
        newEventsFound ||= !!nextId;
      } while (nextId);
    } finally {
      await client.query(Queries.rollback());
      client.release();
    }
    return newEventsFound;
  }

  async processNextNewEvent(client: pg.PoolClient, processorId: string, nextId: number): Promise<number | null> {
    await client.query(Queries.begin());

    const {
      rows: [newEvent],
    } = await client.query<PostgresEvent>(Queries.lockNewEvent(this.tableName, processorId, nextId, this.eventType));

    if (!newEvent) return null;

    const { eventType, externalId, id }: PostgresEvent = newEvent;
    try {
      await client.query(Queries.lockRelatedEvents(this.tableName, processorId, eventType, externalId));
    } catch (err: any) {
      if (err?.code === SQL_STATE_RECORD_LOCK) return null;
      throw err;
    }

    let eventStatus: PostgresEventStatus = PostgresEventStatus.error;
    await client.query(Queries.savepoint());
    try {
      await this.processEvent(newEvent, client);
      await client.query(Queries.releaseSavepoint());
      eventStatus = PostgresEventStatus.complete;
    } catch {
      await client.query(Queries.rollbackToSavepoint());
    }

    await client.query(Queries.setEventStatus(this.tableName, processorId, eventStatus));
    await client.query(Queries.commit());
    return id;
  }
}

export { PgEventEngine as Service };
