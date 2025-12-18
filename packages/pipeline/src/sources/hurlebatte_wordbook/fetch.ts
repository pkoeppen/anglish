import { type FetchPlan } from "../../stages/01_fetch";

const SPREADSHEET_ID = "1y8_11RDvuCRyUK_MXj5K7ZjccgCUDapsPDI5PjaEkMw";

export function fetchPlan(): FetchPlan {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&id=${SPREADSHEET_ID}`;

  return {
    source: "hurlebatte",
    jobs: [
      {
        source: "hurlebatte",
        kind: "csv",
        url,
        headers: {
          accept: "text/csv,*/*;q=0.9",
        },
        meta: {
          spreadsheetId: SPREADSHEET_ID,
          format: "csv",
        },
      },
    ],
  };
}
