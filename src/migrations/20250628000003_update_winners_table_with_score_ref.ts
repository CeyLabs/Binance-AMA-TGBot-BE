import type { Knex } from "knex";

const tableName = "winner";

export async function up(knex: Knex): Promise<void> {
  // First, check if there are any existing records in the winner table
  const existingRecords = await knex(tableName).select("*");

  if (existingRecords.length > 0) {
    // If there are existing records, we need to handle them carefully
    // For now, let's clear the winner table since the data model is changing
    // In production, you might want to migrate the data instead
    await knex(tableName).del();
  }

  await knex.schema.alterTable(tableName, (table) => {
    // Add score_id column that references the scores table
    table
      .uuid("score_id")
      .notNullable()
      .references("id")
      .inTable("scores")
      .onDelete("CASCADE");

    // Remove the direct score column since we'll get it via the relationship
    table.dropColumn("score");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    // Add back the score column
    table.integer("score").notNullable();

    // Remove the score_id reference
    table.dropColumn("score_id");
  });
}
