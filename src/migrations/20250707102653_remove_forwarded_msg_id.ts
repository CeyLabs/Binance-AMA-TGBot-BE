import type { Knex } from "knex";

const tableName = "message";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn("forwarded_msg_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table.bigInteger("forwarded_msg_id");
  });
}
