import YapgClient from '../../src';

const statement1: string = 'SELECT schemaname, tablename FROM pg_tables LIMIT $1';
const statement2: string = 'SELECT schemaname, viewname FROM pg_views';

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    const results = await yapgClient.queries([{ text: statement1, values: [10] }, { text: statement2 }]);
    for (const [i, rows] of results.entries())
      for (const [j, row] of rows.entries()) console.log(`Result: ${i} Row: ${j} ${JSON.stringify(row)}`);
  })();
