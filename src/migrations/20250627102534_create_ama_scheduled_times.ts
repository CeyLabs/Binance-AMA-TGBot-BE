import type { Knex } from "knex";

const tableName = "schedules";

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  await knex.schema.createTable(tableName, (table) => {
    table.increments("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("ama_id")
      .notNullable()
      .references("id")
      .inTable("ama")
      .onDelete("CASCADE");
    table.timestamp("scheduled_time").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}
