import { Transform, type TransformCallback, type TransformOptions } from 'stream';

export enum PgNumber {
  bigint = 'bigint',
  smallint = 'smallint',
  integer = 'integer',
  regproc = 'regproc',
  oid = 'oid',
  real = 'real',
  'double precision' = 'double precision',
  money = 'money',
  numeric = 'numeric',
  regprocedure = 'regprocedure',
  regoper = 'regoper',
  regoperator = 'regoperator',
  regclass = 'regclass',
  regcollation = 'regcollation',
  regtype = 'regtype',
  regrole = 'regrole',
  regnamespace = 'regnamespace',
  regconfig = 'regconfig',
  regdictionary = 'regdictionary',
  cardinal_number = 'cardinal_number',
}

export class PgCsvToJSON extends Transform {
  static escapeSpecialCharacter(byte: '\b' | '\t' | '\n' | '\f' | '\r' | '"' | '/' | '\\'): string {
    switch (byte) {
      case '\b':
        return '\\b';
      case '\t':
        return '\\t';
      case '\n':
        return '\\n';
      case '\f':
        return '\\f';
      case '\r':
        return '\\r';
      case '"':
        return '\\"';
      case '/':
        return '\\/';
      case '\\':
        return '\\\\';
    }
  }

  static isBoolean(type: string): type is 'boolean' {
    return type === 'boolean';
  }

  static isNumber(type: string): type is keyof typeof PgNumber {
    return type in PgNumber;
  }

  static isString(type: string): type is string {
    return !this.isBoolean(type) && !this.isNumber(type);
  }

  booleanColumns: Record<number, boolean> = {};
  columnIndex: number = 0;
  lastByte: string = '';
  quoteCount: number = 0;
  stringColumns: Record<number, boolean> = {};
  withinColumn: boolean = false;

  constructor(public statement: string, public columns: [string, string][], options?: TransformOptions) {
    super({ ...options, emitClose: true });
  }

  get isBeforeRow(): boolean {
    return !this.withinColumn && this.columnIndex === 0;
  }

  get isBooleanColumn(): boolean {
    return this.booleanColumns[this.columnIndex];
  }

  get isEmpty(): boolean {
    return !this.lastByte;
  }

  get isQuoteClosed(): boolean {
    return this.quoteCount % 2 === 0;
  }

  get isStringColumn(): boolean {
    return this.stringColumns[this.columnIndex];
  }

  get isValueQuoted(): boolean {
    return this.quoteCount > 0;
  }

  get isWithinQuotes(): boolean {
    return this.isValueQuoted && !this.isQuoteClosed;
  }

  _construct(callback: TransformCallback): void {
    this.analyzeStatement();
    callback();
  }

  _flush(callback: TransformCallback): void {
    if (this.isEmpty) this.push('[');
    callback(null, ']');
  }

  _transform(chunk: Uint8Array, encoding: BufferEncoding, callback: TransformCallback): void {
    let output: string = '';
    for (const byte of chunk.toString()) {
      if (this.isBeforeRow) {
        if (this.isEmpty) output += '[';
        else output += ',';
        output += '{';
      }

      if (!this.withinColumn) {
        if (this.columnIndex > 0) output += ',';
        output += `"${this.columns[this.columnIndex][0]}":`;
      }

      output += this.transformByte(byte);
      this.lastByte = byte;
    }
    callback(null, output);
  }

  analyzeStatement() {
    for (const [index, [, type]] of this.columns.entries()) {
      if (PgCsvToJSON.isBoolean(type)) this.booleanColumns[index] = true;
      else if (PgCsvToJSON.isString(type)) this.stringColumns[index] = true;
    }
  }

  onBoolean(byte: 'f' | 't'): string {
    return this.onByte(this.isBooleanColumn ? `${byte === 't'}` : byte);
  }

  onByte(byte: string): string {
    let output: string = byte;
    if (!this.withinColumn && !this.isValueQuoted && this.isStringColumn) output = `"${output}`;
    this.withinColumn = true;
    return output;
  }

  onComma(byte: ','): string {
    return this.isWithinQuotes ? this.onByte(byte) : this.onNewColumn();
  }

  onNewColumn(): string {
    let output: string = '';
    if (this.isEmpty || this.lastByte === ',') output = 'null';
    else if (this.isValueQuoted || this.isStringColumn) output = '"';
    this.columnIndex++;
    this.quoteCount = 0;
    this.withinColumn = false;
    return output;
  }

  onNewLine(byte: '\n'): string {
    return this.isWithinQuotes ? this.onSpecialCharacter(byte) : this.onNewRow();
  }

  onNewRow(): string {
    const output: string = this.onNewColumn();
    this.columnIndex = 0;
    return `${output}}`;
  }

  onQuote(byte: '"'): string {
    let output: string = '';
    if (!this.withinColumn) output = byte;
    else if (this.lastByte === byte && this.isQuoteClosed) output = this.onSpecialCharacter(byte);
    this.quoteCount++;
    this.withinColumn = true;
    return output;
  }

  onSpecialCharacter(byte: '\b' | '\t' | '\n' | '\f' | '\r' | '"' | '/' | '\\'): string {
    return this.onByte(PgCsvToJSON.escapeSpecialCharacter(byte));
  }

  transformByte(byte: string): string {
    switch (byte) {
      case '\b':
      case '\t':
      case '\f':
      case '\r':
      case '/':
      case '\\':
        return this.onSpecialCharacter(byte);

      case '\n':
        return this.onNewLine(byte);

      case '"':
        return this.onQuote(byte);

      case ',':
        return this.onComma(byte);

      case 'f':
      case 't':
        return this.onBoolean(byte);

      default:
        return this.onByte(byte);
    }
  }
}

export { PgCsvToJSON as Service };
