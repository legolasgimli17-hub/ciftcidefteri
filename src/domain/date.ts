const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_UTC_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;

export function assertIsoCalendarDate(value: string): void {
  const match = ISO_DATE_RE.exec(value);
  if (!match) {
    throw new Error("Tarih YYYY-AA-GG biçiminde olmalı.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  assertCalendarParts(year, month, day);
}

export function assertIsoUtcTimestamp(value: string): void {
  const match = ISO_UTC_TIMESTAMP_RE.exec(value);
  if (!match) {
    throw new Error("Zaman damgası UTC ISO biçiminde olmalı.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  assertCalendarParts(year, month, day);
  if (hour < 0 || hour > 23) {
    throw new Error("Saat bilgisi geçersiz.");
  }
  if (minute < 0 || minute > 59) {
    throw new Error("Dakika bilgisi geçersiz.");
  }
  if (second < 0 || second > 59) {
    throw new Error("Saniye bilgisi geçersiz.");
  }
}

function assertCalendarParts(year: number, month: number, day: number): void {
  if (year < 2000 || year > 2200) {
    throw new Error("Tarih desteklenen yıl aralığında değil.");
  }
  if (month < 1 || month > 12) {
    throw new Error("Ay bilgisi geçersiz.");
  }

  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error("Gün bilgisi geçersiz.");
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
