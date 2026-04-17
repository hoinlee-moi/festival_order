import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Order, OrderStatus } from "../types";

const ORDERS_QUERY_KEY = ["orders"];

/**
 * 특정 status의 주문 목록을 실시간으로 구독하여 React Query 캐시를 갱신한다.
 */
export function useRealtimeOrders(statusFilter: OrderStatus | OrderStatus[]) {
  const queryClient = useQueryClient();
  const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${statuses.join("-")}`)
      .on<Order>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          // 변경 감지 시 해당 쿼리 무효화 → 자동 refetch
          queryClient.invalidateQueries({
            queryKey: [...ORDERS_QUERY_KEY, ...statuses],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, statuses.join(",")]);
}
