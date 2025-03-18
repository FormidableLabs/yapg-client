import pgFormat from 'pg-format';

export function begin(): string {
  return 'BEGIN';
}

export function commit(): string {
  return 'COMMIT';
}

export function insertNewEvent(tableName: string, externalId: string): string {
  return pgFormat('INSERT INTO %1$I ("externalId") VALUES (%2$L)', tableName, externalId);
}

export function listenToChannel(channelName: string): string {
  return pgFormat('LISTEN %s', channelName);
}

export function lockNewEvent(
  tableName: string,
  processorId: string,
  afterId: number,
  eventType: string | null = null,
): string {
  return pgFormat(
    `
      UPDATE %1$I T
      SET
        "eventStatus" = 'in-progress',
        "processorId" = %2$L,
        "revision" = T."revision" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = (
        SELECT "id"
        FROM %1$I
        WHERE (
          "eventStatus" = 'new'
          AND "id" > %3$s
          AND "eventType" = COALESCE(%4$L, "eventType")
        )
        ORDER BY "id"
        FETCH FIRST ROW ONLY
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        "eventType",
        "externalId",
        "id",
        *
    `,
    tableName,
    processorId,
    afterId,
    eventType,
  );
}

export function lockRelatedEvents(
  tableName: string,
  processorId: string,
  eventType: string,
  externalId: string,
): string {
  return pgFormat.withArray(
    `
      UPDATE %1$I T
      SET
        "eventStatus" = 'in-progress',
        "processorId" = %2$L,
        "revision" = T."revision" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" IN (
        SELECT "id"
        FROM %1$I
        WHERE (
          "externalId" = %3$L
          AND "eventType" = %4$L
          AND "eventStatus" IN ('in-progress', 'new')
        )
        FOR UPDATE NOWAIT
      )
    `,
    [tableName, processorId, externalId, eventType],
  );
}

export function notifyChannel(channelName: string): string {
  return pgFormat('NOTIFY %s', channelName);
}

export function releaseSavepoint(name: string = 'A'): string {
  return pgFormat('RELEASE SAVEPOINT %s', name);
}

export function rollback(): string {
  return 'ROLLBACK';
}

export function rollbackToSavepoint(name: string = 'A'): string {
  return pgFormat('ROLLBACK TO SAVEPOINT %s', name);
}

export function savepoint(name: string = 'A'): string {
  return pgFormat('SAVEPOINT %s', name);
}

export function setEventStatus(
  tableName: string,
  processorId: string,
  eventStatus: string,
): string {
  return pgFormat.withArray(
    `
      UPDATE %I T
      SET
        "eventStatus" = %L,
        "revision" = T."revision" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "processorId" = %L
    `,
    [tableName, eventStatus, processorId],
  );
}
