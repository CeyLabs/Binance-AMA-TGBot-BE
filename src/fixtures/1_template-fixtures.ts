import { Knex } from "knex";

const tableName = "template";

export async function seed(knex: Knex): Promise<void> {
  const [{ count }] = await knex(tableName).count();
  if (Number(count) > 0) return;

  await knex(tableName).insert([{ name: "John" }, { name: "Stacy" }]);
}
