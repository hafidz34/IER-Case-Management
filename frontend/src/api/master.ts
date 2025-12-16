import { api } from "./client";

export type MasterItem = { id: number; name: string };

export const masterApi = {
  list: (kind: string) => api.get<MasterItem[]>(`/api/master/${kind}`),
  create: (kind: string, name: string) =>
    api.post<MasterItem>(`/api/master/${kind}`, { name }),
};
