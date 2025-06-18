import type { Knex } from "knex";

const tableName = "ama";

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.integer("session_no").notNullable().unique();
    table.string("language", 10).notNullable()
    table.date("date").notNullable();
    table.time("time").notNullable();
    table.string("reward").notNullable();
    table.integer("winner_count").notNullable();
    table.string("form_link").notNullable();
    table.string("status").notNullable().defaultTo("pending");
    table.string("special_guest");
    table.string("topic").notNullable();
    table.string("hashtag").notNullable();
    table.timestamp("scheduled_at");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(tableName);
}