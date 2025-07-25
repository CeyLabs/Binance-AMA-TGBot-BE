import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add new roles to the enum
  await knex.raw(`
    ALTER TYPE enum_user_role ADD VALUE IF NOT EXISTS 'admin_new';
    ALTER TYPE enum_user_role ADD VALUE IF NOT EXISTS 'admin_edit';
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Note: PostgreSQL doesn't support removing enum values directly
  // This would require recreating the enum and updating all references
  await knex.raw(`
    CREATE TYPE enum_user_role_new AS ENUM ('super_admin', 'admin', 'regular');
    ALTER TABLE "user" ALTER COLUMN role TYPE enum_user_role_new USING role::text::enum_user_role_new;
    DROP TYPE enum_user_role;
    ALTER TYPE enum_user_role_new RENAME TO enum_user_role;
  `);
}