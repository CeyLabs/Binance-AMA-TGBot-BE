import type { Knex } from "knex";

const tableName = "schedule";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ama_id").notNullable().references("id").inTable("ama").onDelete("CASCADE");
    table.timestamp("scheduled_time").notNullable();
    table
      .enum("type", ["init", "winner"], {
        useNative: true,
        enumName: "enum_type",
      })
      .notNullable();
    table.timestamps(true, true);
    table.index(["scheduled_time"], "schedule_scheduled_time_idx"); // Index for faster lookups
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table(tableName, (table) => {
    table.dropIndex(["scheduled_time"], "schedule_scheduled_time_idx");
  });
  await knex.schema.dropTableIfExists(tableName);
  await knex.raw('DROP TYPE IF EXISTS "enum_type";');
}
