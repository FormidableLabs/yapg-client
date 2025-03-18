import type * as pg from 'pg';

export async function getPoolConfig(options?: Partial<pg.PoolConfig>): Promise<Partial<pg.PoolConfig>> {
  const {
    database = process.env.PGDATABASE || 'postgres',
    host = process.env.PGHOST || 'localhost',
    password = process.env.PGPASSWORD || 'postgres',
    port = +(process.env.PGPORT || 5432),
    user = process.env.PGUSERNAME || 'postgres',
  }: Partial<pg.PoolConfig> = options || {};

  return { ...options, database, host, password, port, user };
}
