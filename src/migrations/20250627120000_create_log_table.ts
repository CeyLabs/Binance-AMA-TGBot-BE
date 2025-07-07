import type { Knex } from "knex";

const tableName = "log";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .enum("level", ["error", "info", "warn"], {
        useNative: true,
        enumName: "enum_log_level",
      })
      .notNullable();
    table.text("text").notNullable();
    table.string("actor").nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists(tableName)
    .raw('DROP TYPE IF EXISTS "enum_log_level";');
}
