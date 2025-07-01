import type { Knex } from "knex";

const tableName = "forwarded_message";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.bigInteger("original_msg_id").notNullable().index();
    table.bigInteger("forwarded_msg_id").notNullable();
    table.uuid("ama_id").notNullable().references("id").inTable("ama").onDelete("CASCADE");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}
