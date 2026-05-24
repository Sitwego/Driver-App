import {
  startOfWeek,
  startOfYear,
  endOfWeek,
  addWeeks,
  addDays,
  eachWeekOfInterval,
} from "date-fns";

// Generate all weeks from January 1st until the current week (no future weeks)
export const generateDateRanges = () => {
  const weeks: Date[][] = [];
  const now = new Date();

  // Start from January 1st of the current year
  const yearStart = startOfYear(now);
  const minDate = startOfWeek(yearStart, { weekStartsOn: 1 });

  // End at the current week (don't include future weeks)
  const maxDate = endOfWeek(now, { weekStartsOn: 1 });

  let currentWeekStart = minDate;

  // Generate all weeks from January until now
  while (currentWeekStart <= maxDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(currentWeekStart, i));
    }
    weeks.push(week);
    currentWeekStart = addWeeks(currentWeekStart, 1);
  }

  return weeks;
};

export function getWeeksForYear(year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const weeks = eachWeekOfInterval(
    { start: yearStart, end: yearEnd },
    { weekStartsOn: 1 },
  ).map((weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    return [weekStart, weekEnd];
  });
  return weeks;
}
