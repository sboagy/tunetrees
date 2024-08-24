/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdapterProcedure {
  path: string;
  method: string;
  body?: object;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  select?: (res: any) => unknown;
}
