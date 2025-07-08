import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  await knex("user")
    .insert({
      user_id: "1",
      name: "Super Admin",
      username: "superadmin",
      role: "super_admin",
    })
    .onConflict("user_id")
    .merge({ role: "super_admin" });
}
