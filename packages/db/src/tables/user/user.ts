import type { Generated, Insertable, Selectable, Updateable } from "kysely";
import type { Default } from "../shared";

export interface UserTable {
  id: Generated<number>;

  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_admin: Default<boolean>;

  created_at: Generated<string>;
  updated_at: Generated<string>;
  deleted_at: string | null;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;
