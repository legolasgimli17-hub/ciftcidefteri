import { assertIsoCalendarDate } from "../domain/date";

const TURKISH_DATE_RE = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/;

export function todayIsoLocal(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateInputFromIso(isoDate: string): string {
  assertIsoCalendarDate(isoDate);
  const [year, month, day] = isoDate.split("-");
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("Tarih gösterilemedi.");
  }
  return `${day}.${month}.${year}`;
}

export function isoDateFromTurkishInput(raw: string): string {
  const match = TURKISH_DATE_RE.exec(raw.trim());
  if (!match) {
    throw new Error("Tarihi GG.AA.YYYY şeklinde yaz.");
  }

  const day = match[1];
  const month = match[2];
  const year = match[3];
  if (day === undefined || month === undefined || year === undefined) {
    throw new Error("Tarihi GG.AA.YYYY şeklinde yaz.");
  }

  const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  try {
    assertIsoCalendarDate(isoDate);
  } catch {
    throw new Error("Tarih geçerli değil.");
  }
  return isoDate;
}
