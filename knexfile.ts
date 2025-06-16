import * as dotenv from 'dotenv';
import type { Knex } from 'knex';

dotenv.config();

// Default pool configuration to ensure connections remain active
const defaultPoolConfig: Knex.PoolConfig = {
  min: 2,
  max: 50,
  idleTimeoutMillis: 30000, // 30 seconds
  acquireTimeoutMillis: 30000, // 30 seconds
  createTimeoutMillis: 30000, // 30 seconds
  reapIntervalMillis: 1000, // 1 second
  createRetryIntervalMillis: 100, // 0.1 seconds
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PW,
      // Keep connections alive
      ssl: false,
      keepAlive: true,
      // Connection validation timeout
      statement_timeout: 60000, // 1 minute
    },
    pool: {
      ...defaultPoolConfig,
    },
    migrations: {
      directory: './src/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/fixtures',
    },
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PW,
      // Enable SSL for production
      ssl: false,
      keepAlive: true,
      // Connection validation timeout
      statement_timeout: 60000, // 1 minute
    },
    pool: {
      ...defaultPoolConfig,
    },
    migrations: {
      directory: './src/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/fixtures',
    },
  },

  localhost: {
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      port: 3009,
      database: 'pizzadao',
      user: 'pizzadao',
      password: 'pizzadao',
      // Keep connections alive
      ssl: false,
      keepAlive: true,
      // Connection validation timeout
      statement_timeout: 60000, // 1 minute
    },
    pool: {
      ...defaultPoolConfig,
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './src/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/fixtures',
    },
  },
};

export default config;
