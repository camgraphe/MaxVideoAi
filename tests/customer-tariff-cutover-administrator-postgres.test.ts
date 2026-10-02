import assert from 'node:assert/strict';
import test from 'node:test';
import { lockPricingCutoverAdministrator, withPricingCutoverTransaction } from '../frontend/server/pricing/customer-tariff-cutover';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const legacyActor = '11111111-1111-4111-8111-111111111111';
const roleActor = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';

test('cutover uses current role administrators, or the same legacy fallback as the app, without granting roles', async () => {
  const database = await startDisposablePostgres('cutover-admin');
  const before = { DATABASE_URL:process.env.DATABASE_URL,NODE_ENV:process.env.NODE_ENV,PRICING_SANDBOX:process.env.PRICING_SANDBOX };
  Object.assign(process.env,{DATABASE_URL:database.databaseUrl,NODE_ENV:'development',PRICING_SANDBOX:'1'});
  const check = (actor: string) => withPricingCutoverTransaction({DATABASE_URL:database.databaseUrl},'rehearsal',executor => lockPricingCutoverAdministrator(executor,actor));
  try {
    await database.pool.query(`CREATE TABLE user_roles (user_id uuid PRIMARY KEY,role text NOT NULL);
      CREATE TABLE app_admins (user_id uuid PRIMARY KEY);
      INSERT INTO app_admins VALUES ('${legacyActor}');
      INSERT INTO user_roles VALUES ('${legacyActor}','user');`);
    await check(legacyActor);
    await assert.rejects(check(outsider), /not an administrator/);
    await assert.rejects(check('invalid'), /Invalid cutover actor/);
    assert.deepEqual((await database.pool.query('SELECT * FROM user_roles')).rows,[{user_id:legacyActor,role:'user'}]);

    await database.pool.query('INSERT INTO user_roles VALUES ($1,\'admin\')',[roleActor]);
    await check(roleActor);
    await assert.rejects(check(legacyActor), /not an administrator/, 'a role admin population takes precedence over the legacy list');
    await database.pool.query('DROP TABLE app_admins');
    await check(roleActor);
    await assert.rejects(check(outsider), /not an administrator/);
    await database.pool.query('DROP TABLE user_roles');
    await assert.rejects(check(roleActor), error => (error as {code?:string}).code === '42P01');
  } finally {
    await database.cleanup();
    for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});

test('the empty role population and legacy authority stay locked until the cutover transaction ends', async () => {
  const database = await startDisposablePostgres('cutover-admin-lock');
  const before = { DATABASE_URL:process.env.DATABASE_URL,NODE_ENV:process.env.NODE_ENV,PRICING_SANDBOX:process.env.PRICING_SANDBOX };
  Object.assign(process.env,{DATABASE_URL:database.databaseUrl,NODE_ENV:'development',PRICING_SANDBOX:'1'});
  try {
    await database.pool.query(`CREATE TABLE user_roles (user_id uuid PRIMARY KEY,role text NOT NULL);
      CREATE TABLE app_admins (user_id uuid PRIMARY KEY);
      INSERT INTO app_admins VALUES ('${legacyActor}');`);
    const other = await database.pool.connect();
    try {
      await other.query('SET statement_timeout=150');
      await withPricingCutoverTransaction({DATABASE_URL:database.databaseUrl},'rehearsal',async executor => {
        await lockPricingCutoverAdministrator(executor,legacyActor);
        await assert.rejects(other.query('INSERT INTO user_roles VALUES ($1,\'admin\')',[roleActor]),
          error => (error as {code?:string}).code === '57014');
        await assert.rejects(other.query('DELETE FROM app_admins WHERE user_id=$1',[legacyActor]),
          error => (error as {code?:string}).code === '57014');
      });
      await other.query('INSERT INTO user_roles VALUES ($1,\'admin\')',[roleActor]);
      assert.equal((await other.query('SELECT count(*)::int AS n FROM user_roles')).rows[0].n,1);
    } finally { other.release(); }
  } finally {
    await database.cleanup();
    for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
