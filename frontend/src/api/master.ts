import { client } from "./client";

export interface MasterItem {
  id: number;
  name: string;
}

export const masterApi = {
  list: async (endpoint: string) => {
    const res = await client.get<MasterItem[]>(`/master/${endpoint}`);
    return res;
  },
};