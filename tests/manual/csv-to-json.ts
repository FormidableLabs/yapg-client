import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import YapgClient from '../../src';

const query: string = `SELECT tablename FROM pg_tables`;

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();

    const stream = await yapgClient.jsonStream(query);

    const writable = new Writable({
      emitClose: true,
      write(chunk, encoding, callback) {
        console.log(chunk.toString('utf8'));
        callback(null);
      },
    });

    await pipeline(stream, writable);
  })();
