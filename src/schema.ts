import * as pg from 'pg';

export interface PgUtilsConfig {
  pool: Partial<pg.PoolConfig>;
}

export interface RowDescriptionMessage {
  fieldCount: number;
  fields: pg.FieldDef[];
  length: number;
  name: string;
}
