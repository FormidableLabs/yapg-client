import YapgClient from '../../src';

const statement: string = 'SELECT schemaname, tablename, * FROM pg_tables';

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    const columns: [string, string][] = await yapgClient.describeStatementColumns(statement);
    for (const [index, [name, type]] of columns.entries()) console.log(`Index: ${index} ${name} ${type}`);
  })();
