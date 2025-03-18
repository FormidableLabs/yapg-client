export interface PostgresEvent {
  [key: string]: any;
  id: number;
  eventStatus: PostgresEventStatus;
  eventType: string;
  externalId: string;
}

export enum PostgresEventStatus {
  complete = 'complete',
  error = 'error',
  new = 'new',
  running = 'running',
}
