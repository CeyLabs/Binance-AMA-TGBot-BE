import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add foreign key constraint from scores to users
  await knex.schema.alterTable("scores", (table) => {
    table
      .foreign("user_id")
      .references("user_id")
      .inTable("users")
      .onDelete("RESTRICT");
  });

  // Add foreign key constraint from winner to users
  await knex.schema.alterTable("winner", (table) => {
    table
      .foreign("user_id")
      .references("user_id")
      .inTable("users")
      .onDelete("RESTRICT");
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove foreign key constraints
  await knex.schema.alterTable("scores", (table) => {
    table.dropForeign(["user_id"]);
  });

  await knex.schema.alterTable("winner", (table) => {
    table.dropForeign(["user_id"]);
  });
}
