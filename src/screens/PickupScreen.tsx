import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrdersByStatus, useUpdateOrderStatus } from "../hooks/useOrders";
import { useRealtimeOrders } from "../hooks/useRealtimeOrders";
import { supabase } from "../lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Order, RootStackParamList, SmsStatus } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Pickup">;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function PickupScreen({ navigation }: Props) {
  const { data: orders = [], isLoading, isError } = useOrdersByStatus("READY");
  const updateStatus = useUpdateOrderStatus();
  useRealtimeOrders("READY");

  const [smsStates, setSmsStates] = React.useState<Record<string, SmsStatus>>(
    {},
  );

  const handleSendSms = async (order: Order) => {
    const current = getSmsState(order);
    if (
      current === "SENDING" ||
      current === "SENT" ||
      current === "SEND_UNKNOWN"
    ) {
      return;
    }

    setSmsStates((prev) => ({ ...prev, [order.id]: "SENDING" }));

    try {
      const { data, error } = await supabase.functions.invoke(
        "send-pickup-sms",
        {
          body: { orderId: order.id },
        },
      );

      if (error) {
        const response = (error as { context?: Response }).context;
        const errorBody = response
          ? await response.json().catch(() => null)
          : null;
        const status = errorBody?.status as SmsStatus | undefined;
        setSmsStates((prev) => ({
          ...prev,
          [order.id]: status ?? "SEND_UNKNOWN",
        }));
        throw new Error(
          errorBody?.error ??
            error.message ??
            "SMS 요청 결과를 확인하지 못했습니다.",
        );
      }

      if (data?.ok === false) {
        const status = data?.status as SmsStatus | undefined;
        setSmsStates((prev) => ({
          ...prev,
          [order.id]: status ?? "FAILED",
        }));
        throw new Error(data?.error ?? "SMS 발송 실패");
      }

      setSmsStates((prev) => ({
        ...prev,
        [order.id]: (data?.status as SmsStatus | undefined) ?? "SENT",
      }));
    } catch (error) {
      setSmsStates((prev) => ({
        ...prev,
        [order.id]:
          prev[order.id] === "SENDING" ? "SEND_UNKNOWN" : prev[order.id],
      }));
      Alert.alert(
        "SMS 상태 확인 필요",
        error instanceof Error
          ? error.message
          : "메시지 요청 결과를 확인하지 못했습니다.",
      );
    }
  };

  const handleComplete = (order: Order) => {
    Alert.alert(
      "최종 완료",
      `대기번호 ${order.order_number}번 수령 완료 처리할까요?`,
      [
        { text: "아니요", style: "cancel" },
        {
          text: "완료",
          onPress: () =>
            updateStatus.mutate(
              { id: order.id, status: "COMPLETED" },
              {
                onError: () => {
                  Alert.alert(
                    "오류",
                    "최종 완료 처리에 실패했습니다. 네트워크 연결을 확인하세요.",
                  );
                },
              },
            ),
        },
      ],
    );
  };

  const getSmsState = (order: Order): SmsStatus => {
    const localState = smsStates[order.id];
    const serverState = order.sms_status || "NOT_SENT";
    if (localState === "SENDING") return localState;
    if (serverState !== "NOT_SENT" && localState !== serverState) {
      return serverState;
    }
    return localState || serverState;
  };

  const getSmsButtonStyle = (order: Order) => {
    const st = getSmsState(order);
    if (st === "SENDING") return styles.smsSending;
    if (st === "SENT") return styles.smsSent;
    if (st === "SEND_UNKNOWN") return styles.smsUnknown;
    if (st === "FAILED") return styles.smsFailed;
    return styles.smsDefault;
  };

  const getSmsButtonText = (order: Order) => {
    const st = getSmsState(order);
    if (st === "SENDING") return "발송 중...";
    if (st === "SENT") return "발송 완료";
    if (st === "SEND_UNKNOWN") return "확인 필요";
    if (st === "FAILED") return "재발송";
    return "📲 SMS 발송";
  };

  const getSmsStatusText = (order: Order) => {
    const st = getSmsState(order);
    if (st === "SENDING") return "SMS 발송 요청 처리 중";
    if (st === "SENT") return "SMS 발송 확인됨";
    if (st === "SEND_UNKNOWN") return "요청 결과 불명확 - 중복 발송 방지 중";
    if (st === "FAILED") return "발송 실패 - 재시도 가능";
    return "SMS 미발송";
  };

  const isSmsButtonDisabled = (order: Order) => {
    const st = getSmsState(order);
    return st === "SENDING" || st === "SENT" || st === "SEND_UNKNOWN";
  };

  const renderOrderCard = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      {/* 상단: 대기번호 + 전화번호 */}
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{item.order_number}</Text>
        <Text style={styles.phone}>{formatPhone(item.phone_number)}</Text>
      </View>

      {/* 메뉴 목록 */}
      <View style={styles.itemsList}>
        {item.items.map((menuItem, idx) => (
          <Text key={idx} style={styles.menuItemText}>
            {menuItem.menuName} × {menuItem.quantity}
          </Text>
        ))}
      </View>

      <Text style={styles.smsStatusText}>{getSmsStatusText(item)}</Text>

      {/* 버튼 영역 */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.smsBtn, getSmsButtonStyle(item)]}
          activeOpacity={0.7}
          onPress={() => handleSendSms(item)}
          disabled={isSmsButtonDisabled(item)}
        >
          <Text style={styles.smsBtnText}>{getSmsButtonText(item)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.doneBtn}
          activeOpacity={0.7}
          onPress={() => handleComplete(item)}
        >
          <Text style={styles.doneBtnText}>최종 완료</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: "RoleSelect" }] })
          }
        >
          <Text style={styles.backBtn}>← 처음으로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📦 배출구</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{orders.length}건 준비됨</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 60 }} />
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            주문 목록을 불러오지 못했습니다. 네트워크 연결을 확인하세요.
          </Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>☕</Text>
          <Text style={styles.emptyText}>준비된 주문이 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderOrderCard}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  // 헤더
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#1a1a2e",
  },
  backBtn: { fontSize: 15, color: "#ddd", fontWeight: "800", marginRight: 12 },
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#fff", flex: 1 },
  badge: {
    backgroundColor: "#3498db",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  // 빈 상태
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyEmoji: { fontSize: 60, marginBottom: 12 },
  emptyText: { fontSize: 22, color: "#888", fontWeight: "800" },
  // 리스트
  list: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 14,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  // 카드 헤더
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  orderNumber: { fontSize: 44, fontWeight: "900", color: "#1a1a2e" },
  phone: { fontSize: 30, color: "#555", fontWeight: "800" },
  // 메뉴 아이템
  itemsList: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemText: {
    fontSize: 36,
    color: "#222",
    marginBottom: 8,
    fontWeight: "900",
  },
  // 버튼 영역
  cardActions: { flexDirection: "row", gap: 10 },
  smsBtn: {
    flex: 1,
    paddingVertical: 17,
    borderRadius: 10,
    alignItems: "center",
  },
  smsDefault: { backgroundColor: "#3498db" },
  smsSending: { backgroundColor: "#95a5a6", opacity: 0.7 },
  smsSent: { backgroundColor: "#27ae60" },
  smsUnknown: { backgroundColor: "#f39c12" },
  smsFailed: { backgroundColor: "#e74c3c" },
  smsBtnText: { fontSize: 30, fontWeight: "900", color: "#fff" },
  smsStatusText: {
    color: "#555",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 14,
  },
  doneBtn: {
    flex: 1,
    paddingVertical: 17,
    borderRadius: 10,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  doneBtnText: { fontSize: 30, fontWeight: "900", color: "#fff" },
});
