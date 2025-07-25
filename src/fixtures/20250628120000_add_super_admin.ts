import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  await knex("user")
    .insert({
      user_id: "1202862098",
      name: "MoeX Mohamad 🔶Binance",
      username: "Moexba",
      role: "super_admin",
    })
}
