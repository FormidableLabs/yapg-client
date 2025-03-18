import type * as pg from 'pg';

export interface RowDescriptionMessage {
  fieldCount: number;
  fields: pg.FieldDef[];
  length: number;
  name: string;
}

export type Constructor<T> = new (...args: any) => T;

export type Consumable<T> = Iterable<T> | (() => IterableIterator<T> | AsyncIterableIterator<T>);
