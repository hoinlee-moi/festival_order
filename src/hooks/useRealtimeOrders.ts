import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { OrderStatus } from "../types";

const ORDERS_QUERY_KEY = ["orders"];

// 전역에서 단일 채널만 유지
let globalChannel: ReturnType<typeof supabase.channel> | null = null;
let subscriberCount = 0;

/**
 * orders 테이블 변경을 실시간 구독하여 React Query 캐시를 갱신한다.
 * 여러 화면에서 호출해도 단일 채널을 공유한다.
 */
export function useRealtimeOrders(_statusFilter?: OrderStatus | OrderStatus[]) {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    subscriberCount++;

    if (!globalChannel) {
      globalChannel = supabase
        .channel("orders-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
          },
          () => {
            queryClientRef.current.invalidateQueries({
              queryKey: ORDERS_QUERY_KEY,
            });
          },
        )
        .subscribe();
    }

    return () => {
      subscriberCount--;
      if (subscriberCount <= 0 && globalChannel) {
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        subscriberCount = 0;
      }
    };
  }, []);
}
