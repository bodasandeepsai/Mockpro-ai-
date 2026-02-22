import moment from 'moment'

export function parseDateFromString(dateString) {
  if (!dateString) return null;
  try {
    // Strict DD-MM-YYYY
    const ddmmyyyy = /^\d{2}-\d{2}-\d{4}$/;
    const yyyymmdd = /^\d{4}-\d{2}-\d{2}$/;
    if (ddmmyyyy.test(dateString)) {
      const [day, month, year] = dateString.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    if (yyyymmdd.test(dateString)) {
      // treat as UTC date-only
      return new Date(dateString + 'T00:00:00Z');
    }
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

export function formatDateForDisplay(dateString) {
  const d = parseDateFromString(dateString);
  if (!d) return 'Invalid Date';
  return moment(d).format('MMM DD, YYYY');
}

export function formatDateForDB(date = new Date()) {
  return moment(date).format('DD-MM-YYYY');
}

export default {
  parseDateFromString,
  formatDateForDisplay,
  formatDateForDB
}
