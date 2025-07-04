import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Converts a KSA datetime to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04")
 * @param time - The time string in KSA timezone (e.g., "20:00:00")
 * @returns The datetime in UTC
 */
function convertDateTimeToUTC(date: string, time: string): dayjs.Dayjs {
  const ksaDatetime = `${date}T${time}`;
  if (!dayjs(ksaDatetime).isValid()) {
    throw new Error(`Invalid datetime format: ${ksaDatetime}`);
  }
  return dayjs.tz(ksaDatetime, "Asia/Riyadh").utc();
}

/**
 * Converts a KSA date to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04")
 * @param originalTime - The original time string to use for conversion (optional)
 * @returns The date in UTC
 */
export function convertDateToUTC(date: string, originalTime?: string): string {
  const timeToUse = originalTime || "00:00:00";
  return convertDateTimeToUTC(date, timeToUse).format("YYYY-MM-DD");
}

/**
 * Converts a KSA time to UTC.
 * @param time - The time string in KSA timezone (e.g., "20:00:00")
 * @param originalDate - The original date string to use for conversion (optional)
 * @returns The time in UTC
 */
export function convertTimeToUTC(time: string, originalDate?: string): string {
  const dateToUse = originalDate || dayjs().format("YYYY-MM-DD");
  return convertDateTimeToUTC(dateToUse, time).format("HH:mm:ss");
}

/**
 * Converts a date and time from KSA timezone to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04").
 * @param time - The time string in KSA timezone (e.g., "20:00:00").
 * @returns An object containing the converted date and time in UTC.
 */
export function convertToUTC(date: string, time: string): { dateUTC: string; timeUTC: string } {
  // Create a KSA datetime string and parse it in KSA timezone
  const ksaDatetime = `${date}T${time}`;

  // Parse in KSA timezone and convert to UTC
  const utcDateTime = dayjs.tz(ksaDatetime, "Asia/Riyadh").utc();

  const result = {
    dateUTC: utcDateTime.format("YYYY-MM-DD"),
    timeUTC: utcDateTime.format("HH:mm:ss"),
  };

  return result;
}

/**
 * Converts UTC date and time back to KSA timezone
 * @param date - The date string in UTC (YYYY-MM-DD)
 * @param time - The time string in UTC (HH:mm:ss)
 * @returns The datetime in KSA timezone
 */
export function convertUTCToKSA(date: string, time: string): { ksaDate: string; ksaTime: string } {
  // Create a UTC datetime string and parse it as UTC
  const utcDatetime = `${date}T${time}`;
  // Explicitly parse as UTC first
  const utcMoment = dayjs.utc(utcDatetime);
  // Convert to KSA timezone
  const ksaDateTime = utcMoment.tz("Asia/Riyadh");
  const result = {
    ksaDate: ksaDateTime.format("YYYY-MM-DD"),
    ksaTime: ksaDateTime.format("HH:mm:ss"),
  };

  return result;
}
