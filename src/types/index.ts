// ===== Menu =====
export interface Menu {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  sort_order: number;
  created_at: string;
}

// ===== Order =====
export type OrderStatus = "PENDING" | "READY" | "COMPLETED" | "CANCELLED";
export type SmsStatus =
  | "NOT_SENT"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "SEND_UNKNOWN";
export type PaymentMethod = "CASH" | "CARD";

export interface OrderItem {
  menuName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  order_number: number;
  event_date: string;
  phone_number: string;
  items: OrderItem[];
  total_price: number;
  status: OrderStatus;
  sms_status: SmsStatus;
  last_sms_at: string | null;
  payment_method: PaymentMethod;
  closed_at: string | null;
  created_at: string;
}

// ===== Cart (카운터 로컬 상태) =====
export interface CartItem {
  menuId: string;
  menuName: string;
  price: number;
  quantity: number;
}

// ===== App Role =====
export type AppRole = "counter" | "kitchen" | "pickup";

// ===== Navigation =====
export type RootStackParamList = {
  RoleSelect: undefined;
  Counter: undefined;
  Kitchen: undefined;
  Pickup: undefined;
  MenuManage: undefined;
  SalesDashboard: undefined;
};

// ===== Sales Dashboard =====
export interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  cashRevenue: number;
  cashOrders: number;
  cardRevenue: number;
  cardOrders: number;
}
