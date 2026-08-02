// Ride date/time are stored as free-form display strings (e.g. "August 12", "3:30 PM"),
// not ISO timestamps, so every screen that needs a real Date has to parse them the same way.
export function parseRideDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    const currentYear = new Date().getFullYear();
    const parsed = new Date(`${dateStr}, ${currentYear} ${timeStr}`);
    if (!isNaN(parsed.getTime())) return parsed;

    const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (timeParts) {
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2]);
      if (timeParts[3].toUpperCase() === "PM" && hours < 12) hours += 12;
      if (timeParts[3].toUpperCase() === "AM" && hours === 12) hours = 0;

      const dateParts = dateStr.match(/(\w+)\s+(\d+)/);
      if (dateParts) {
        const months = [
          "january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december",
        ];
        const monthIdx = months.indexOf(dateParts[1].toLowerCase());
        if (monthIdx !== -1) return new Date(currentYear, monthIdx, parseInt(dateParts[2]), hours, minutes);
      }
    }
    return null;
  } catch {
    return null;
  }
}
