export function isNowBeforeOrEqual(targetDateStr: string): boolean {
  const now = new Date();
  const target = new Date(targetDateStr);
  return target.getTime() <= now.getTime();
}

export function formatTime(timeInSeconds: number): string {
  if (timeInSeconds >= 60) {
    return `${Math.floor(timeInSeconds / 60)}Mins`;
  } else if (timeInSeconds > 0) {
    return `${timeInSeconds}Sec`;
  } else {
    return "0";
  }
}
