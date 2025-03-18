import { Transform, TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';
import YapgClient from '../../src';

const readQuery: string = `
  COPY (SELECT tablename FROM pg_tables)
  TO STDOUT
  WITH (FORMAT CSV, ENCODING UTF8, HEADER FALSE)
`;

const writeQuery: string = `
  COPY tables (table_name)
  FROM STDIN
  WITH (FORMAT CSV, ENCODING UTF8, HEADER FALSE)
`;

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();

    const readClient = await yapgClient.pool.connect();

    const readable = YapgClient.PgUtils.toReadable(readQuery, readClient);

    await yapgClient
      .transaction(async (writeClient) => {
        await writeClient.query('CREATE TEMPORARY TABLE tables (table_name text)');

        const transform = new Transform({
          transform(chunk: Uint8Array, _encoding: BufferEncoding, callback: TransformCallback) {
            console.log(chunk.toString());
            callback(null, chunk);
          },
        });

        const writable = YapgClient.PgUtils.toWritable(writeQuery, writeClient);

        await pipeline(readable, transform, writable);
      })
      .finally(() => readClient.release());
  })();
