[![yapg-client — Formidable, We build the modern web](https://raw.githubusercontent.com/FormidableLabs/yapg-client/main/yapg-client-Hero.png)](https://formidable.com/open-source/)

**Yet Another Postgres Client**

This is an un-opinionated Postgres client with the goal of providing a one-stop shop for interacting with Postgres. This client brings additional capability to the widely used [Node Postgres](https://node-postgres.com/) set of libraries. This client intends to make some interactions with Postgres more intuitive.

This client should be considered a companion to, and in some cases, nothing more than a thinly veined wrapper around Node Postgres. In fact, you are expected to freely use the exposed `pool` property as needed.

Similar to Node Postgres, this is **not** an object relational mapping (ORM) client. This client expects raw SQL input to many functions. If you're using an ORM and this package, you'll need to obtain or provide the raw SQL statement(s) somehow.

# Usage

```sh
npm i yapg-client
```

# Instantiation

This client implements the zero-argument, asynchronous configuration pattern described [here](https://formidable.com/blog/2022/zero-argument/). This makes it easy to instantiate the client. Simply use the static, asynchronous `new` method:

**Signature**

```typescript
class YapgClient extends PgQueryRunner.Service {
  static async new<T>(
    this: Constructor<T>,
    ...[config, ...rest]: Partial<ConstructorParameters<typeof YapgClient>>
  ): Promise<T>;
}
```

| Argument | Data Type           | Description                                 | Example        |
| :------- | :------------------ | :------------------------------------------ | :------------- |
| config   | Partial<PoolConfig> | An optional Node Postgres PoolConfig object | `{ max: 100 }` |

> **Note** The `config` object extends the existing Node Postgres `PoolConfig`. See documentation regarding this interface [here](https://node-postgres.com/apis/pool#new-pool).

The config parameter is entirely optional. When omitted, the client will attempt to connect to a generic Postgres instance on the local machine, using the following assumed environment variables:

```sh
PGDATABASE=postgres
PGHOST=localhost
PGPASSWORD=postgres
PGPORT=5432
PGUSERNAME=postgres
```

**Return Value**

The `new` method returns a `Promise` resolving to a newly configured instance of the client.

**Example**

```typescript
import YapgClient from 'yapg-client';
if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    const rows = await yapgClient.query('SELECT * FROM pg_tables LIMIT $1', [10]);
  })();
```

# Features

## Describe Statement Columns

If you have a dynamic SQL statement that you want to know the data types and names of the result columns, use the `describeStatementColumns` feature:

**Signature**

```typescript
class YapgClient extends PgQueryRunner.Service {
  async describeStatementColumns<V>(
    text: string,
    values?: V[],
    client?: pg.PoolClient,
  ): Promise<[string, string][]>;
}
```

| Argument | Data Type  | Description                               | Example                               |
| :------- | :--------- | :---------------------------------------- | :------------------------------------ |
| text     | string     | The text of the SQL query to describe.    | `'SELECT \* FROM pg_tables LIMIT $1'` |
| values   | unknown[]  | Any substitution parameters values.       | `[100]`                               |
| client   | PoolClient | An optional client to describe the query. |                                       |

**Example**

```typescript
import YapgClient from 'yapg-client';

const statement: string = 'SELECT schemaname, tablename, * FROM pg_tables';

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    const columns: [string, string][] = await yapgClient.describeStatementColumns(statement);
    for (const [index, [name, type]] of columns.entries())
      console.log(`Index: ${index} ${name} ${type}`);
  })();
```

The result is an array of tuples. The first entry of each tuple is the name of the column. The second entry of each tuple is the SQL type.

The above query produces a response such as:

```sh
Index: 0 schemaname name
Index: 1 tablename name
Index: 2 schemaname name
Index: 3 tablename name
Index: 4 tableowner name
Index: 5 tablespace name
Index: 6 hasindexes boolean
Index: 7 hasrules boolean
Index: 8 hastriggers boolean
Index: 9 rowsecurity boolean
```

---

## Streaming Inputs and Outputs

To stream responses from and to Postgres, use the `toReadable` and `toWritable` features, respectively:

**Signature**

```typescript
class PgUtils {
  static toReadable(
    text: string,
    client: pg.PoolClient,
    options?: TransformOptions,
  ): CopyToStreamQuery;

  static toWritable(
    text: string,
    client: pg.PoolClient,
    options?: TransformOptions,
  ): CopyStreamQuery;
}
```

| Argument | Data Type        | Description                                   | Example                                       |
| :------- | :--------------- | :-------------------------------------------- | :-------------------------------------------- |
| text     | string           | The text of the SQL COPY command.             | `'COPY (SELECT \* FROM pg_tables) TO STDOUT'` |
| client   | PoolClient       | An optional client to describe the query.     |                                               |
| options  | TransformOptions | Any optional configuration for the Transform. | `{ highWatermark: 65535 }`                    |

> **Note** When using `toReadable` you should specify a `COPY ... TO` statement. Conversely, when using `toWritable` you should specify a `COPY ... FROM` statement.

The result of `toReadable` is a `Readable` Node.js stream and the result of `toWritable` is a `Writable` Node.js stream.

**Example**

Below is an example of constructing an ETL stream. A `COPY ... TO STDOUT` query is piped into a `Transform`. The result of the `Transform` is then piped into a `COPY ... FROM STDIN` query.

```typescript
import { Transform, TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';
import YapgClient from 'yapg-client';

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
          transform(chunk: Uint8Array, encoding: BufferEncoding, callback: TransformCallback) {
            console.log(chunk.toString());
            callback(null, chunk);
          },
        });

        const writable = YapgClient.PgUtils.toWritable(writeQuery, writeClient);

        await pipeline(readable, transform, writable);
      })
      .finally(() => readClient.release());
  })();
```

> **Note** A given Postgres client can only have a single active query or command at any one time. The ETL stream requires two clients: one for reading and one for writing. Furthermore, to ensure database integrity, the write client is encapsulated within a transaction. As always, it is important to remember to always release any manually connected client.

---

## Streaming JSON

In addition to the `toReadable` and `toWritable` methods, a higher-order convenience method `jsonStream` is also available.

**Signature**

```typescript
class YapgClient extends PgQueryRunner.Service {
  async jsonStream(
    text: string,
    client?: pg.PoolClient,
    options?: TransformOptions,
  ): Promise<PgCsvToJSON.Service>;
}
```

| Argument | Data Type        | Description                                   | Example                      |
| :------- | :--------------- | :-------------------------------------------- | :--------------------------- |
| text     | string           | The text of the query to COPY.                | `'SELECT \* FROM pg_tables'` |
| client   | PoolClient       | An optional client to execute the query.      |                              |
| options  | TransformOptions | Any optional configuration for the Transform. | `{ highWatermark: 65535 }`   |

> **Note** Do not specify a COPY statement. Instead, specify the query you would otherwise wrap in the COPY statement. The query you specify is explicitly wrapped in a COPY statement internally.

The result of `jsonStream` is the destination of the constructed COPY statement. This transform converts the Postgres CSV stream into a JSON stream.

**Example**

Below is an example of streaming a query into its JSON form:

```typescript
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import YapgClient from 'yapg-client';

const query: string = `SELECT REPEAT('X', 160000)`;

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();

    const stream = await yapgClient.jsonStream(query);

    const writable = new Writable({
      emitClose: true,
      write(chunk, encoding, callback) {
        console.log(chunk.toString('utf8'));
        callback();
      },
    });

    await pipeline(stream, writable);
  })();
```

> **Note** Chunks of data will be received by the stream and transmitted as a raw JSON data stream. This is suitable for those applications that want to stream `application/json` data in `chunked` transfer encoding.

---

## Running Queries

This client provides a handful of wrapper methods to assist with basic query processing.

> **Note** Ultimately, the underlying Node Postgres `query` function is executed. If the provided wrapper methods do not meet your needs, you are encouraged to use the exposed `pool` property of the client. See more about Node Postgres pools [here](https://node-postgres.com/apis/pool).

### Running a Single Query

If you want to run a single query, use the `query` method:

**Signature**

```typescript
class PgQueryRunner {
  async query<R, V>(text: string, values?: V[], client?: pg.PoolClient): Promise<R[]>;
}
```

| Argument | Data Type  | Description                           | Example                               |
| :------- | :--------- | :------------------------------------ | :------------------------------------ |
| text     | string     | The text of the SQL query to execute. | `'SELECT \* FROM pg_tables LIMIT $1'` |
| values   | unknown[]  | Any substitution parameters values.   | `[100]`                               |
| client   | PoolClient | An optional client to run the query.  |                                       |

> **Note** If there are no `values` you can omit the parameter, specify the `undefined` value or specify an empty array `[]`.

> **Note** The `client` parameter allows you to control the client that executes the query. This is especially important for transactions, since all Postgres transactions are scoped to a client instance.

**Return Value**

The `query` method returns a `Promise` that resolves to an array of rows. Each entry in the array is an object having column names as keys paired with their corresponding value(s).

> **Note** If you need more fine-tuned control over the input, output, or configuration of running a query, you are encouraged to use the existing `query` method available on the exposed `pool` property. The `query` method exposed here is a convenience method that unwraps the full response and only returns the rows as an array of objects.

**Example**

Here is an example of running a single parameterized query:

```typescript
import YapgClient from 'yapg-client';

const statement: string = 'SELECT schemaname, tablename, * FROM pg_tables LIMIT $1';

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    const rows = await yapgClient.query(statement, [1]);
    for (const [index, row] of rows.entries())
      console.log(`Index: ${index} ${JSON.stringify(row)}`);
  })();
```

### Running a Query Sequence

If you want to run a sequence of queries, use the `queries` method:

**Signature**

```typescript
class PgQueryRunner {
  async queries<R, V>(
    queries: Consumable<{ text: string; values?: V[] }>,
    client?: pg.PoolClient,
  ): Promise<R[][]>;
}
```

| Argument | Data Type  | Description                                     | Example                                                       |
| :------- | :--------- | :---------------------------------------------- | :------------------------------------------------------------ |
| queries  | Consumable | A provider of SQL query text and value pair(s). | `[{text: 'SELECT * FROM pg_tables LIMIT $1', values: [100]}]` |
| client   | PoolClient | An optional client to run the queries.          |                                                               |

The `Consumable` type is defined as:

```typescript
export type Consumable<T> = Iterable<T> | (() => IterableIterator<T> | AsyncIterableIterator<T>);
```

This means that your provider can be any object implementing the `Iterable` protocol e.g. `Array`, `Set` etc. Your provider can also be a lazily invoked function that returns either a synchronous or asynchronous iterator e.g. generator function.

**Return Value**

The `queries` method returns a `Promise` resolving to a two-dimensional array. The first dimension corresponds to the results of each query executed. The second dimension corresponds to the rows of the individual queries.

**Example**

Here is an example of running two queries, one that is parameterized and one that is not.

```typescript
import YapgClient from 'yapg-client';

const statement1: string = 'SELECT schemaname, tablename FROM pg_tables LIMIT $1';
const statement2: string = 'SELECT schemaname, viewname FROM pg_views';

if (require.main === module)
  (async () => {
    const yapgClient = await YapgClient.new();
    const results = await yapgClient.queries([
      { text: statement1, values: [10] },
      { text: statement2 },
    ]);
    for (const [i, rows] of results.entries())
      for (const [j, row] of rows.entries())
        console.log(`Result: ${i} Row: ${j} ${JSON.stringify(row)}`);
  })();
```

## Running Transactions

If you need to group two or more SQL statements as a single unit of work, use the `transaction` method:

**Signature**

```typescript
class PgQueryRunner {
  async transaction<R>(
    transaction: (client: pg.PoolClient) => Promise<R>,
    client?: pg.PoolClient,
  ): Promise<R>;
}
```

| Argument    | Data Type  | Description                                | Example   |
| :---------- | :--------- | :----------------------------------------- | :-------- |
| transaction | Function   | The lazily invoked transaction callback.   | See below |
| client      | PoolClient | An optional client to run the transaction. |           |

When using transactions, you will be required to provide a lazily invoked asynchronous function. Your function will receive a client from the pool. Using that client, your transaction callback function can perform any number of SQL statements.

Before your callback is invoked, the SQL command `BEGIN` is executed to start a transaction. Next, your transaction callback is invoked and its outcome is awaited. Once your function completes normally, the SQL command `COMMIT` is executed and any changes are committed to the database.

To prevent the changes from being committed for any reason e.g. the event of a error, your callback must throw an error. When this happens, the error is caught and the SQL command `ROLLBACK` is executed and any changes to the database are discarded. Finally, the same error is re-thrown.

> **Note** In all cases, the client is automatically released. Do not release the client when using the `transaction` feature.

> **Note** If you provide the client as an optional parameter, then that client is forwarded to the transaction callback. In this case, client connection/release and transaction SQL commands are not executed. This allows you to create transaction segments. You will be required to handle the transaction boundary, the decision to commit or rollback, and the manual release of the client.

**Example**

The following example demonstrates the `transaction` feature:

```typescript
import YapgClient from 'yapg-client';

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
```
