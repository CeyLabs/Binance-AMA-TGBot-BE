import type { Knex } from "knex";

const tableName = "users";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    table.string("user_id").primary(); // Telegram user ID as string
    table.string("name").nullable();
    table.string("username").nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}
