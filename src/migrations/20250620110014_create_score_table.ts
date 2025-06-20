import type { Knex } from "knex";

const tableName = "scores";

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .integer("session_no")
      .notNullable()
      .references("session_no")
      .inTable("ama")
      .onDelete("RESTRICT");
    table.string("user_id").notNullable();
    table.string("username");
    table.string("question").notNullable();
    table.integer("originality").notNullable();
    table.integer("relevance").notNullable();
    table.integer("clarity").notNullable();
    table.integer("engagement").notNullable();
    table.integer("language").notNullable();
    table.integer("score").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}
