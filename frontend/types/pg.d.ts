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
    on(event: 'error', listener: (error: Error, client: PoolClient) => void): this;
    query<T = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
