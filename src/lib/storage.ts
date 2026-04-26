import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Menu } from "../types";

const MENUS_CACHE_KEY = "@festival_order/menus";
const ALL_MENUS_CACHE_KEY = "@festival_order/menus/all";

export async function getCachedMenus(): Promise<Menu[] | null> {
  try {
    const json = await AsyncStorage.getItem(MENUS_CACHE_KEY);
    if (!json) return null;
    return JSON.parse(json) as Menu[];
  } catch {
    return null;
  }
}

export async function setCachedMenus(menus: Menu[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MENUS_CACHE_KEY, JSON.stringify(menus));
  } catch {
    console.warn("[Storage] 메뉴 캐시 저장 실패");
  }
}

export async function getCachedAllMenus(): Promise<Menu[] | null> {
  try {
    const json = await AsyncStorage.getItem(ALL_MENUS_CACHE_KEY);
    if (!json) return null;
    return JSON.parse(json) as Menu[];
  } catch {
    return null;
  }
}

export async function setCachedAllMenus(menus: Menu[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ALL_MENUS_CACHE_KEY, JSON.stringify(menus));
  } catch {
    console.warn("[Storage] 전체 메뉴 캐시 저장 실패");
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const json = await AsyncStorage.getItem(key);
    if (!json) return null;
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn(`[Storage] 캐시 저장 실패: ${key}`);
  }
}

export async function clearCachedMenus(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MENUS_CACHE_KEY);
    await AsyncStorage.removeItem(ALL_MENUS_CACHE_KEY);
  } catch {
    console.warn("[Storage] 메뉴 캐시 삭제 실패");
  }
}
