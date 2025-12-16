import { type ColumnType } from "kysely";

export type Default<T> = ColumnType<T, T | null | undefined, T>;
