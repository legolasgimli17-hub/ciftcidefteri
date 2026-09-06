const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function assertIsoCalendarDate(value: string): void {
  const match = ISO_DATE_RE.exec(value);
  if (!match) {
    throw new Error("Tarih YYYY-AA-GG biçiminde olmalı.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

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
