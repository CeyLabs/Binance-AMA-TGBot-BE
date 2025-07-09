import type { Knex } from "knex";

const tableName = "winner";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("ama_id")
      .notNullable()
      .references("id")
      .inTable("ama")
      .onDelete("CASCADE");
    table
      .string("user_id")
      .notNullable()
      .references("user_id")
      .inTable("user")
      .onDelete("RESTRICT");
    table
      .uuid("message_id")
      .notNullable()
      .references("id")
      .inTable("message")
      .onDelete("CASCADE");
    table.integer("rank").notNullable(); // 1st, 2nd, etc.
    table.timestamps(true, true);

    table.unique(["ama_id", "user_id"]); // prevent duplicate winners for the same AMA
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}
