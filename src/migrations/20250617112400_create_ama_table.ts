import type { Knex } from "knex";

const tableName = "ama";

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.integer("session_no").notNullable();
    table
      .enum("language", ["en", "ar"], {
        useNative: true,
        enumName: "enum_language",
      })
      .notNullable();
    table.timestamp("datetime").notNullable();
    table.string("total_pool").notNullable();
    table.string("reward").notNullable();
    table.integer("winner_count").notNullable();
    table.string("form_link").notNullable();
    table
      .enum("status", ["pending", "scheduled", "broadcasted", "active", "ended"], {
        useNative: true,
        enumName: "enum_status",
      })
      .notNullable()
      .defaultTo("pending");
    table.string("special_guest");
    table.string("topic");
    table.string("hashtag").notNullable();
    table.string("banner_file_id");
    table.integer("thread_id");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists(tableName)
    .raw('DROP TYPE IF EXISTS "enum_language", "enum_status";');
}
