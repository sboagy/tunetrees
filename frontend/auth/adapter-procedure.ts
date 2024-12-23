/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IAdapterProcedure {
  path: string;
  method: string;
  body?: object;

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  select?: (res: any) => unknown;
}
