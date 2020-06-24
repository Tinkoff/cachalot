import Timer = NodeJS.Timer;

export default async (time: number): Promise<Timer> =>
  new Promise((resolve: (timeout: Timer) => void): void => {
    const timeout: Timer = setTimeout(() => resolve(timeout), time);
  });
