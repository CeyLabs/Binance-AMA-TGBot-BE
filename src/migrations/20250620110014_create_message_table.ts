import type { Knex } from "knex";

const tableName = "message";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ama_id").notNullable().references("id").inTable("ama").onDelete("RESTRICT");
    table
      .string("user_id")
      .notNullable()
      .references("user_id")
      .inTable("user")
      .onDelete("RESTRICT");
    table.text("question").notNullable();
    table.integer("originality").notNullable();
    table.integer("relevance").notNullable();
    table.integer("clarity").notNullable();
    table.integer("engagement").notNullable();
    table.integer("language").notNullable();
    table.integer("score").notNullable();
    table.boolean("processed").notNullable().defaultTo(false);
    table.bigInteger("tg_msg_id").notNullable();
    table.bigInteger("forwarded_msg_id").nullable();
    table.bigInteger("chat_id").nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}
