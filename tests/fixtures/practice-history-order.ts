/** Shared by SQLite tests and the read-only local Postgres parity check. */
export const historyOrderFixtures = [
  { id: "a", practiced: "2026-11-16T12:00:00.999999Z", lastModifiedAt: null },
  { id: "b", practiced: "2026-11-16T12:00:00.999998Z", lastModifiedAt: null },
  {
    id: "c",
    practiced: "2026-11-16T13:00:00.123456+01:00",
    lastModifiedAt: "2026-11-17T10:00:00Z",
  },
  {
    id: "d",
    practiced: "2026-11-16 07:00:00.123456-05",
    lastModifiedAt: "2026-11-17T10:00:00.000001Z",
  },
  {
    id: "e",
    practiced: "2026-11-16T12:00:00.123456Z",
    lastModifiedAt: "2026-11-17T10:00:00.000001Z",
  },
  { id: "f", practiced: "2026-11-16T12:00:00", lastModifiedAt: null },
  {
    id: "g",
    practiced: "2026-11-16T12:00:00.000001+0000",
    lastModifiedAt: null,
  },
  { id: "h", practiced: "2026-11-16T11:00:00Z", lastModifiedAt: null },
  { id: "i", practiced: null, lastModifiedAt: "2026-11-18T10:00:00Z" },
  { id: "j", practiced: null, lastModifiedAt: null },
];
export const expectedHistoryIds = [
  "a",
  "b",
  "e",
  "d",
  "c",
  "g",
  "f",
  "h",
  "i",
  "j",
];
