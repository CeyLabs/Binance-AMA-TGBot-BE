import type { Knex } from "knex";

const tableName = "ama";

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.integer("ama_no").notNullable().unique();
    table.string("title").notNullable();
    table.integer("topic_id").notNullable().unique();
    table.string("hashtag").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(tableName);
}