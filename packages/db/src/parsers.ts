import { DateTime } from "luxon";
import pg from "pg";
import { PG_COUNT_OID } from "./constants";

export function initParsers() {
  pg.types.setTypeParser(PG_COUNT_OID, str => BigInt(str));
  pg.types.setTypeParser(pg.types.builtins.NUMERIC, str => Number.parseFloat(str));
  pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, str => DateTime.fromSQL(str).toJSDate());
}
