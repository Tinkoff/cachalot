export default async (time: number): Promise<number> =>
  new Promise((resolve: (timeout: number) => void): void => {
    const timeout = setTimeout(() => resolve(timeout), time);
  });
