import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getCachedJson, setCachedJson } from "../lib/storage";
import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  SalesSummary,
  SmsStatus,
} from "../types";

const ORDERS_QUERY_KEY = ["orders"];

const buildCacheKey = (parts: Array<string | undefined>) =>
  `@festival_order/${parts.map((part) => part ?? "all").join("/")}`;

async function getCachedOrThrow<T>(key: string, message: string): Promise<T> {
  const cached = await getCachedJson<T>(key);
  if (cached) return cached;
  throw new Error(message);
}

export function useOrdersByStatus(
  status: OrderStatus | OrderStatus[],
  eventDate?: string,
) {
  const statuses = Array.isArray(status) ? status : [status];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, ...statuses, eventDate ?? "all"],
    queryFn: async (): Promise<Order[]> => {
      const cacheKey = buildCacheKey(["orders", statuses.join("-"), eventDate]);

      try {
        let query = supabase
          .from("orders")
          .select("*")
          .in("status", statuses)
          .is("closed_at", null);

        if (eventDate) {
          query = query.eq("event_date", eventDate);
        }

        const { data, error } = await query.order("created_at", {
          ascending: true,
        });

        if (error) throw error;

        const orders = data as Order[];
        await setCachedJson(cacheKey, orders);
        return orders;
      } catch {
        return getCachedOrThrow<Order[]>(
          cacheKey,
          "주문 목록을 불러올 수 없습니다. 네트워크 연결을 확인하세요.",
        );
      }
    },
    refetchInterval: false,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      phone_number: string;
      items: OrderItem[];
      total_price: number;
      payment_method: PaymentMethod;
    }): Promise<Order> => {
      const today = new Date().toISOString().split("T")[0];
      const { data: maxData, error: maxError } = await supabase
        .from("orders")
        .select("order_number")
        .is("closed_at", null)
        .order("order_number", { ascending: false })
        .limit(1);

      if (maxError) throw maxError;

      const nextNumber =
        maxData && maxData.length > 0 ? maxData[0].order_number + 1 : 1;

      const { data, error } = await supabase
        .from("orders")
        .insert({
          order_number: nextNumber,
          event_date: today,
          phone_number: params.phone_number,
          items: params.items,
          total_price: params.total_price,
          payment_method: params.payment_method,
          status: "PENDING",
          sms_status: "NOT_SENT",
        })
        .select()
        .single();

      if (error) throw error;
      return data as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: params.status })
        .eq("id", params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useUpdateSmsStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; sms_status: SmsStatus }) => {
      const { error } = await supabase
        .from("orders")
        .update({
          sms_status: params.sms_status,
          last_sms_at: new Date().toISOString(),
        })
        .eq("id", params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useSalesSummary(date?: string) {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, "sales", targetDate],
    queryFn: async (): Promise<SalesSummary> => {
      const cacheKey = buildCacheKey(["orders", "sales", targetDate]);

      try {
        const start = `${targetDate}T00:00:00.000Z`;
        const next = new Date(targetDate);
        next.setDate(next.getDate() + 1);
        const end = `${next.toISOString().split("T")[0]}T00:00:00.000Z`;

        const { data, error } = await supabase
          .from("orders")
          .select("total_price, payment_method")
          .gte("created_at", start)
          .lt("created_at", end)
          .eq("status", "COMPLETED");

        if (error) throw error;

        const orders = data ?? [];
        const cashOrders = orders.filter(
          (order) => order.payment_method === "CASH",
        );
        const cardOrders = orders.filter(
          (order) => order.payment_method === "CARD",
        );
        const sumRevenue = (targetOrders: typeof orders) =>
          targetOrders.reduce(
            (sum, order) => sum + (order.total_price ?? 0),
            0,
          );

        const summary = {
          totalRevenue: sumRevenue(orders),
          totalOrders: orders.length,
          cashRevenue: sumRevenue(cashOrders),
          cashOrders: cashOrders.length,
          cardRevenue: sumRevenue(cardOrders),
          cardOrders: cardOrders.length,
        };

        await setCachedJson(cacheKey, summary);
        return summary;
      } catch {
        return getCachedOrThrow<SalesSummary>(
          cacheKey,
          "매출 정보를 불러올 수 없습니다. 네트워크 연결을 확인하세요.",
        );
      }
    },
    refetchInterval: false,
  });
}

export function useCompletedOrdersByDate(date?: string) {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, "completed-by-date", targetDate],
    queryFn: async (): Promise<Order[]> => {
      const cacheKey = buildCacheKey([
        "orders",
        "completed-by-date",
        targetDate,
      ]);

      try {
        const start = `${targetDate}T00:00:00.000Z`;
        const next = new Date(targetDate);
        next.setDate(next.getDate() + 1);
        const end = `${next.toISOString().split("T")[0]}T00:00:00.000Z`;

        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .gte("created_at", start)
          .lt("created_at", end)
          .eq("status", "COMPLETED")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const orders = data as Order[];
        await setCachedJson(cacheKey, orders);
        return orders;
      } catch {
        return getCachedOrThrow<Order[]>(
          cacheKey,
          "완료 주문을 불러올 수 없습니다. 네트워크 연결을 확인하세요.",
        );
      }
    },
    refetchInterval: false,
  });
}

export function useOrdersByDate(date?: string) {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, "by-date", targetDate],
    queryFn: async (): Promise<Order[]> => {
      const cacheKey = buildCacheKey(["orders", "by-date", targetDate]);

      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("event_date", targetDate)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const orders = data as Order[];
        await setCachedJson(cacheKey, orders);
        return orders;
      } catch {
        return getCachedOrThrow<Order[]>(
          cacheKey,
          "날짜별 주문 목록을 불러올 수 없습니다. 네트워크 연결을 확인하세요.",
        );
      }
    },
    refetchInterval: false,
  });
}

export function useCloseSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const closedAt = new Date().toISOString();

      const { error: completeError } = await supabase
        .from("orders")
        .update({ status: "COMPLETED", closed_at: closedAt })
        .is("closed_at", null)
        .in("status", ["PENDING", "READY", "COMPLETED"]);

      if (completeError) throw completeError;

      const { error: cancelCloseError } = await supabase
        .from("orders")
        .update({ closed_at: closedAt })
        .is("closed_at", null)
        .eq("status", "CANCELLED");

      if (cancelCloseError) throw cancelCloseError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}
