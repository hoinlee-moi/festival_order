import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrdersByStatus, useUpdateOrderStatus } from "../hooks/useOrders";
import { useRealtimeOrders } from "../hooks/useRealtimeOrders";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Order, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Pickup">;

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + "-****-" + phone.slice(-4);
}

export default function PickupScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const { data: orders = [], isLoading } = useOrdersByStatus("READY");
  const updateStatus = useUpdateOrderStatus();
  useRealtimeOrders("READY");

  // SMS 상태를 로컬로 관리 (더미)
  const [smsStates, setSmsStates] = React.useState<Record<string, string>>({});

  const handleSendSms = (orderId: string) => {
    const current = smsStates[orderId];
    if (current === "SENDING") return;

    setSmsStates((prev) => ({ ...prev, [orderId]: "SENDING" }));

    // 2초 후 발송 완료로 변경 (더미)
    setTimeout(() => {
      setSmsStates((prev) => ({ ...prev, [orderId]: "SENT" }));
    }, 2000);
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
            updateStatus.mutate({ id: order.id, status: "COMPLETED" }),
        },
      ],
    );
  };

  const getSmsState = (orderId: string) => smsStates[orderId] || "NOT_SENT";

  const getSmsButtonStyle = (orderId: string) => {
    const st = getSmsState(orderId);
    if (st === "SENDING") return styles.smsSending;
    if (st === "SENT") return styles.smsSent;
    return styles.smsDefault;
  };

  const getSmsButtonText = (orderId: string) => {
    const st = getSmsState(orderId);
    if (st === "SENDING") return "발송 중...";
    if (st === "SENT") return "✅ 발송 완료";
    return "📲 SMS 발송";
  };

  const renderOrderCard = ({ item }: { item: Order }) => (
    <View style={[styles.orderCard, isWide && styles.orderCardWide]}>
      {/* 상단: 대기번호 + 전화번호 */}
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{item.order_number}</Text>
        <Text style={styles.phone}>{maskPhone(item.phone_number)}</Text>
      </View>

      {/* 메뉴 목록 */}
      <View style={styles.itemsList}>
        {item.items.map((menuItem, idx) => (
          <Text key={idx} style={styles.menuItemText}>
            {menuItem.menuName} × {menuItem.quantity}
          </Text>
        ))}
      </View>

      {/* 버튼 영역 */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.smsBtn, getSmsButtonStyle(item.id)]}
          activeOpacity={0.7}
          onPress={() => handleSendSms(item.id)}
          disabled={getSmsState(item.id) === "SENDING"}
        >
          <Text style={styles.smsBtnText}>{getSmsButtonText(item.id)}</Text>
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
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("RoleSelect")}>
          <Text style={styles.backBtn}>← 처음으로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📦 배출구</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{orders.length}건 준비됨</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 60 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>☕</Text>
          <Text style={styles.emptyText}>준비된 주문이 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          numColumns={isWide ? 2 : 1}
          key={isWide ? "wide" : "narrow"}
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
  backBtn: { fontSize: 14, color: "#aaa", fontWeight: "600", marginRight: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#fff", flex: 1 },
  badge: {
    backgroundColor: "#3498db",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // 빈 상태
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyEmoji: { fontSize: 60, marginBottom: 12 },
  emptyText: { fontSize: 20, color: "#aaa", fontWeight: "600" },
  // 리스트
  list: { padding: 12 },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  orderCardWide: { flex: 1, marginHorizontal: 6 },
  // 카드 헤더
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  orderNumber: { fontSize: 28, fontWeight: "900", color: "#1a1a2e" },
  phone: { fontSize: 15, color: "#888", fontWeight: "500" },
  // 메뉴 아이템
  itemsList: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemText: {
    fontSize: 16,
    color: "#444",
    marginBottom: 4,
    fontWeight: "500",
  },
  // 버튼 영역
  cardActions: { flexDirection: "row", gap: 10 },
  smsBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  smsDefault: { backgroundColor: "#3498db" },
  smsSending: { backgroundColor: "#95a5a6", opacity: 0.7 },
  smsSent: { backgroundColor: "#27ae60" },
  smsBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  doneBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
