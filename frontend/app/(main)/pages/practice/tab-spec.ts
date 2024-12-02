export interface ITabSpec {
  id: string;
  name: string;
  content: string;
  visible: boolean;
}

export const initialTabSpec: ITabSpec[] = [
  {
    id: "scheduled",
    name: "Practice",
    content: "Review and practice your scheduled tunes.",
    visible: true,
  },
  {
    id: "repertoire",
    name: "Repertoire",
    content: "Manage your repertoire.",
    visible: true,
  },
  {
    id: "all",
    name: "Catalog",
    content:
      "View full tune catalog, and add tunes from catalog to repertoire.",
    visible: true,
  },
  {
    id: "analysis",
    name: "Analysis",
    content: "Practice Analytics.",
    visible: true,
  },
];
