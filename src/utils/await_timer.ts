export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
export const awaitTimer = async (ms: number) => {
  await delay(ms);
};
export const awaitTimerWithCallback = async (
  ms: number,
  callback: () => void,
) => {
  await delay(ms);
  callback();
};
export const awaitTimerWithCallbackAndArgs = async (
  ms: number,
  callback: (...args: any[]) => void,
  ...args: any[]
) => {
  await delay(ms);
  callback(...args);
};
export const awaitTimerWithCallbackAndArgsAndReturn = async (
  ms: number,
  callback: (...args: any[]) => any,
  ...args: any[]
) => {
  await delay(ms);
  return callback(...args);
};
export const awaitTimerWithCallbackAndArgsAndReturnWithDelay = async (
  ms: number,
  callback: (...args: any[]) => any,
  delayMs: number,
  ...args: any[]
) => {
  await delay(ms);
  await delay(delayMs);
  return callback(...args);
};
