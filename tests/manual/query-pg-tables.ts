import YapgClient from '../../src';

const statement: string = 'SELECT schemaname, tablename, * FROM pg_tables LIMIT $1';

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    const rows = await yapgClient.query(statement, [1]);
    for (const [index, row] of rows.entries()) console.log(`Index: ${index} ${JSON.stringify(row)}`);
  })();
