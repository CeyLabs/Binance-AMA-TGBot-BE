import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Converts a date and time from KSA timezone to UTC.
 * @param date - The date string in KSA timezone (e.g., "2025-07-04").
 * @param time - The time string in KSA timezone (e.g., "20:00:00").
 * @returns An object containing the converted date and time in UTC.
 */
export function convertToUTC(date: string, time: string): { dateUTC: string; timeUTC: string } {
  const datetime = `${date}T${time}`; // Combine date and time into a full datetime string

  if (!dayjs(datetime).isValid()) {
    throw new Error(`Invalid datetime format: ${datetime}`);
  }

  const datetimeUTC = dayjs.tz(datetime, "Asia/Riyadh").utc().format();
  return { dateUTC: datetimeUTC.split("T")[0], timeUTC: datetimeUTC.split("T")[1] };
}
