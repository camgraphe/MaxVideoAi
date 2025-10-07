declare module 'pg' {
  export interface PoolConfig {
    connectionString?: string;
  }

  export interface QueryResult<T = unknown> {
    rows: T[];
  }

  export interface PoolClient {
    query<T = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<QueryResult<T>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
