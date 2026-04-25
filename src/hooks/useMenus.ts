import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getCachedMenus, setCachedMenus } from "../lib/storage";
import type { Menu } from "../types";

const MENUS_QUERY_KEY = ["menus"];
const ALL_MENUS_QUERY_KEY = ["menus", "all"];

async function fetchMenus(): Promise<Menu[]> {
  try {
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const menus = data as Menu[];
    await setCachedMenus(menus);
    return menus;
  } catch {
    // 서버 실패 시 로컬 캐시 fallback
    const cached = await getCachedMenus();
    if (cached) return cached;
    throw new Error("메뉴를 불러올 수 없습니다. 네트워크 연결을 확인하세요.");
  }
}

async function fetchAllMenus(): Promise<Menu[]> {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as Menu[];
}

export function useMenus() {
  return useQuery({
    queryKey: MENUS_QUERY_KEY,
    queryFn: fetchMenus,
    staleTime: Infinity, // 수동 갱신 전까지 캐시 유지
    gcTime: Infinity,
  });
}

export function useAllMenus() {
  return useQuery({
    queryKey: ALL_MENUS_QUERY_KEY,
    queryFn: fetchAllMenus,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useRefreshMenus() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: MENUS_QUERY_KEY });
}
