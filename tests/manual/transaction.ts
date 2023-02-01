import YapgClient from '../../src';

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    await yapgClient.transaction(async (client) => {
      const [, , [row]] = await yapgClient.queries(
        [
          { text: `CREATE TEMPORARY TABLE foo_bar (c1 TEXT)` },
          { text: `INSERT INTO foo_bar VALUES ($1)`, values: ['baz'] },
          { text: `SELECT * FROM foo_bar` },
        ],
        client,
      );
      console.log(row);
    });
  })();
