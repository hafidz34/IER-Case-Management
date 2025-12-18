import { api } from "./client";

export type MasterItem = { id: number; name: string };

export const masterApi = {
  list: (kind: string) => api.get<MasterItem[]>(`/api/master/${kind}`),
  create: (kind: string, name: string) =>
    api.post<MasterItem>(`/api/master/${kind}`, { name }),
  update: (kind: string, id: number, name: string) =>
    api.put<MasterItem>(`/api/master/${kind}/${id}`, { name }),
  remove: (kind: string, id: number) =>
    api.delete<{ status: string; id: number }>(`/api/master/${kind}/${id}`),
};
