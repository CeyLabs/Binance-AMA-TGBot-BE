import type { Knex } from "knex";

const tableName = "user";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table
      .enum("role", ["super_admin", "admin", "regular"], {
        useNative: true,
        enumName: "enum_user_role",
      })
      .notNullable()
      .defaultTo("regular");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn("role");
  });
  await knex.raw('DROP TYPE IF EXISTS "enum_user_role";');
}
