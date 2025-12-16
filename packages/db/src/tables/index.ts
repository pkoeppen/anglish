import type { UserTable } from "./user";

export * from "./user";

export interface DB {
  user: UserTable;
}
