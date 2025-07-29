import type { Knex } from "knex";

const tableName = "user";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    table.string("user_id").primary(); // Telegram user ID as string
    table.string("name").nullable();
    table.string("username").nullable();
    table.specificType("subscribed_groups", "text[]").notNullable().defaultTo("{}");
    table
      .enum("role", ["super_admin", "admin", "host", "editor", "regular"], {
        useNative: true,
        enumName: "enum_user_role",
      })
      .notNullable()
      .defaultTo("regular");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
  await knex.raw('DROP TYPE IF EXISTS "enum_user_role";');
}
