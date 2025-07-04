import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Converts a KSA date to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04")
 * @returns The date in UTC
 */
export function convertDateToUTC(date: string): string {
  if (!dayjs(date).isValid()) {
    throw new Error(`Invalid date format: ${date}`);
  }
  return dayjs.tz(date, "Asia/Riyadh").utc().format("YYYY-MM-DD");
}

/**
 * Converts a KSA time to UTC.
 * @param time - The time string in KSA timezone (e.g., "20:00:00")
 * @returns The time in UTC
 */
export function convertTimeToUTC(time: string): string {
  // Use current date to validate time
  const today = dayjs().format("YYYY-MM-DD");
  const datetime = `${today}T${time}`;

  if (!dayjs(datetime).isValid()) {
    throw new Error(`Invalid time format: ${time}`);
  }

  return dayjs.tz(datetime, "Asia/Riyadh").utc().format("HH:mm:ss");
}

/**
 * Converts a date and time from KSA timezone to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04").
 * @param time - The time string in KSA timezone (e.g., "20:00:00").
 * @returns An object containing the converted date and time in UTC.
 */
export function convertToUTC(date: string, time: string): { dateUTC: string; timeUTC: string } {
  return {
    dateUTC: convertDateToUTC(date),
    timeUTC: convertTimeToUTC(time),
  };
}
