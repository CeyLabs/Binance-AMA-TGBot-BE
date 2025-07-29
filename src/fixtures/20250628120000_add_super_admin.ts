import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  await knex("user")
    .insert({
      user_id: "1435789682",
      name: "MoeX Mohamad 🔶Binance",
      username: "Moexba",
      role: "admin",
    })
}
