import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type {
  Order,
  OrderStatus,
  OrderItem,
  SalesSummary,
  PaymentMethod,
} from "../types";

const ORDERS_QUERY_KEY = ["orders"];

// ===== 주문 목록 조회 (status 필터, 마감되지 않은 주문) =====
export function useOrdersByStatus(status: OrderStatus | OrderStatus[]) {
  const statuses = Array.isArray(status) ? status : [status];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, ...statuses],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", statuses)
        .is("closed_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Order[];
    },
    refetchInterval: false,
  });
}

// ===== 주문 생성 =====
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      phone_number: string;
      items: OrderItem[];
      total_price: number;
      payment_method: PaymentMethod;
    }): Promise<Order> => {
      // 마감되지 않은 (현재 영업 세션) 최대 대기번호 조회
      const today = new Date().toISOString().split("T")[0];
      const { data: maxData } = await supabase
        .from("orders")
        .select("order_number")
        .is("closed_at", null)
        .order("order_number", { ascending: false })
        .limit(1);

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

// ===== 주문 상태 업데이트 =====
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

// ===== SMS 상태 업데이트 =====
export function useUpdateSmsStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; sms_status: "SENDING" }) => {
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

// ===== 매출 조회 (특정 날짜) =====
// date: "YYYY-MM-DD" 형식, 미지정 시 오늘
export function useSalesSummary(date?: string) {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, "sales", targetDate],
    queryFn: async (): Promise<SalesSummary> => {
      const start = `${targetDate}T00:00:00.000Z`;
      const next = new Date(targetDate);
      next.setDate(next.getDate() + 1);
      const end = `${next.toISOString().split("T")[0]}T00:00:00.000Z`;

      const { data, error } = await supabase
        .from("orders")
        .select("total_price, status, payment_method")
        .gte("created_at", start)
        .lt("created_at", end)
        .eq("status", "COMPLETED");

      if (error) throw error;

      const orders = data ?? [];
      const cash = orders.filter((o) => o.payment_method === "CASH");
      const card = orders.filter((o) => o.payment_method === "CARD");
      const sum = (arr: typeof orders) =>
        arr.reduce((s, o) => s + (o.total_price ?? 0), 0);

      return {
        totalRevenue: sum(orders),
        totalOrders: orders.length,
        cashRevenue: sum(cash),
        cashOrders: cash.length,
        cardRevenue: sum(card),
        cardOrders: card.length,
      };
    },
    refetchInterval: false,
  });
}

// ===== 날짜별 완료 주문 목록 =====
export function useCompletedOrdersByDate(date?: string) {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, "completed-by-date", targetDate],
    queryFn: async (): Promise<Order[]> => {
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
      return data as Order[];
    },
    refetchInterval: false,
  });
}

// ===== 영업 마감 (미마감 주문 모두에 closed_at 기록) =====
// 호출 시 다음 주문번호가 다시 #1부터 시작됨
export function useCloseSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ closed_at: new Date().toISOString() })
        .is("closed_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Order, OrderStatus, OrderItem, SalesSummary } from "../types";

const ORDERS_QUERY_KEY = ["orders"];

// ===== 주문 목록 조회 (status 필터) =====
export function useOrdersByStatus(status: OrderStatus | OrderStatus[]) {
  const statuses = Array.isArray(status) ? status : [status];

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, ...statuses],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", statuses)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Order[];
    },
    refetchInterval: false, // 실시간 트리거로 갱신
  });
}

// ===== 주문 생성 =====
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      phone_number: string;
      items: OrderItem[];
      total_price: number;
    }): Promise<Order> => {
      // 당일 최대 대기번호 조회
      const today = new Date().toISOString().split("T")[0];
      const { data: maxData } = await supabase
        .from("orders")
        .select("order_number")
        .eq("event_date", today)
        .order("order_number", { ascending: false })
        .limit(1);

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

// ===== 주문 상태 업데이트 =====
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

// ===== SMS 상태 업데이트 =====
export function useUpdateSmsStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; sms_status: "SENDING" }) => {
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

// ===== 매출 대시보드 =====
export function useSalesSummary() {
  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, "sales"],
    queryFn: async (): Promise<SalesSummary> => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("orders")
        .select("total_price, status")
        .eq("event_date", today)
        .in("status", ["PENDING", "READY", "COMPLETED"]);

      if (error) throw error;

      const orders = data ?? [];
      const completedOrders = orders.filter((o) => o.status === "COMPLETED");
      const totalRevenue = completedOrders.reduce(
        (sum, o) => sum + o.total_price,
        0,
      );

      return {
        totalRevenue,
        totalOrders: orders.length,
      };
    },
    refetchInterval: false,
  });
}
