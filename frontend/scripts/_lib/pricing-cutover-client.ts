import { Pool, type PoolClient, type PoolConfig } from 'pg';

/** All work is read-only; a disconnected reader never returns publishable evidence. */
export async function withPricingCutoverReadOnlyClient<T>(config: PoolConfig,
  work: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = new Pool(config);
  let client: PoolClient | undefined;
  let lost = false;
  let result!: T;
  const onError = () => { lost = true; };
  pool.on('error', onError);
  try {
    client = await pool.connect();
    client.on('error', onError);
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    result = await work(client);
    if (lost) throw new Error('Schema inventory connection was lost.');
  } catch (error) {
    if (lost) throw new Error('Schema inventory connection was lost.');
    throw error;
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(onError);
      client.release(lost);
    }
    await pool.end();
  }
  if (lost) throw new Error('Schema inventory connection was lost.');
  return result;
}
