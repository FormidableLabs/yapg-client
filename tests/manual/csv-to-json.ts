import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import YapgClient from '../../src';

const query: string = `
  SELECT
    '" "" "' AS C0,
    '"' AS C1,
    '' AS C2,
    '" ' AS C3,
    ' "' AS C4,
    ' " ' AS C5,
    ',' AS C6,
    ' ,' AS C7,
    ', ' AS C8,
    ' , ' AS C9,
    '/' AS C10,
    '\\' AS C11,
    null AS C12,
    E'\\b' AS C13,
    E'\\t' AS C14,
    E'\\n' AS C15,
    E'\\f' AS C16,
    E'\\r' AS C17,
    'abc' AS C18,
    1.23::float AS C19,
    456 AS C20
`;

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
