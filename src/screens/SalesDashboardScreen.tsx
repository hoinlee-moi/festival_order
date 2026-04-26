import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Order, RootStackParamList } from "../types";
import {
  useCloseSession,
  useCompletedOrdersByDate,
  useSalesSummary,
} from "../hooks/useOrders";
import { useRealtimeOrders } from "../hooks/useRealtimeOrders";

type Props = NativeStackScreenProps<RootStackParamList, "SalesDashboard">;

const getTodayString = () => new Date().toISOString().split("T")[0];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${year}.${month}.${day} (${weekday})`;
};

const shiftDate = (dateString: string, days: number) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

export default function SalesDashboardScreen({ navigation }: Props) {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const isToday = selectedDate === getTodayString();

  const {
    data: salesSummary,
    isLoading,
    isError: salesError,
  } = useSalesSummary(selectedDate);
  const { data: completedOrders = [], isError: completedOrdersError } =
    useCompletedOrdersByDate(selectedDate);
  const closeSession = useCloseSession();

  useRealtimeOrders(["PENDING", "READY", "COMPLETED"]);

  const handleCloseSession = () => {
    Alert.alert(
      "영업 마감",
      "현재 영업을 마감하시겠습니까?\n아직 완료되지 않은 주문도 모두 완료 처리됩니다.\n다음 주문번호는 다시 #1부터 시작됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "마감",
          style: "destructive",
          onPress: async () => {
            try {
              await closeSession.mutateAsync();
              Alert.alert("완료", "영업이 마감되었습니다.");
            } catch {
              Alert.alert("오류", "마감 처리에 실패했습니다.");
            }
          },
        },
      ],
    );
  };

  const renderCompletedOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderRow}>
      <Text style={styles.orderNum}>#{item.order_number}</Text>
      <View style={styles.orderMid}>
        <Text style={styles.orderItems} numberOfLines={2}>
          {item.items
            .map((orderItem) => `${orderItem.menuName}x${orderItem.quantity}`)
            .join(", ")}
        </Text>
        <Text style={styles.orderMethod}>
          {item.payment_method === "CARD" ? "카드" : "현금"}
        </Text>
      </View>
      <Text style={styles.orderPrice}>
        {item.total_price.toLocaleString()}원
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← 돌아가기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>매출 조회</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.dateBar}>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => setSelectedDate((date) => shiftDate(date, -1))}
        >
          <Text style={styles.dateNavText}>이전</Text>
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          {!isToday && (
            <TouchableOpacity onPress={() => setSelectedDate(getTodayString())}>
              <Text style={styles.todayBtn}>오늘로</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]}
          onPress={() =>
            !isToday && setSelectedDate((date) => shiftDate(date, 1))
          }
          disabled={isToday}
        >
          <Text style={styles.dateNavText}>다음</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 60 }} />
      ) : salesError || completedOrdersError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            매출 정보를 불러오지 못했습니다. 네트워크 연결을 확인하세요.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>총 매출</Text>
            <Text style={styles.totalValue}>
              {(salesSummary?.totalRevenue ?? 0).toLocaleString()}원
            </Text>
            <Text style={styles.totalCount}>
              총 {salesSummary?.totalOrders ?? 0}건
            </Text>
          </View>

          <View style={styles.methodRow}>
            <View style={[styles.methodCard, styles.cashCard]}>
              <Text style={styles.methodLabel}>현금</Text>
              <Text style={styles.methodValue}>
                {(salesSummary?.cashRevenue ?? 0).toLocaleString()}원
              </Text>
              <Text style={styles.methodCount}>
                {salesSummary?.cashOrders ?? 0}건
              </Text>
            </View>
            <View style={[styles.methodCard, styles.cardCard]}>
              <Text style={styles.methodLabel}>카드</Text>
              <Text style={styles.methodValue}>
                {(salesSummary?.cardRevenue ?? 0).toLocaleString()}원
              </Text>
              <Text style={styles.methodCount}>
                {salesSummary?.cardOrders ?? 0}건
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>완료된 주문 내역</Text>
          <FlatList
            data={completedOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={renderCompletedOrder}
            ListEmptyComponent={
              <Text style={styles.emptyText}>완료된 주문이 없습니다</Text>
            }
          />

          {isToday && (
            <TouchableOpacity
              style={[
                styles.closeBtn,
                closeSession.isPending && styles.btnDisabled,
              ]}
              onPress={handleCloseSession}
              disabled={closeSession.isPending}
            >
              <Text style={styles.closeBtnText}>
                {closeSession.isPending
                  ? "마감 중..."
                  : "영업 마감 (주문번호 초기화)"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { fontSize: 14, color: "#aaa", fontWeight: "600" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  dateBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
  },
  dateNavBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  dateNavBtnDisabled: { opacity: 0.3 },
  dateNavText: { fontSize: 14, fontWeight: "700", color: "#555" },
  dateCenter: { alignItems: "center" },
  dateText: { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  todayBtn: { fontSize: 12, color: "#3498db", marginTop: 2 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  totalCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 14, color: "#aaa", marginBottom: 6 },
  totalValue: { fontSize: 32, fontWeight: "800", color: "#fff" },
  totalCount: { fontSize: 14, color: "#ffd460", marginTop: 4 },
  methodRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  methodCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderTopWidth: 3,
  },
  cashCard: { borderTopColor: "#2ecc71" },
  cardCard: { borderTopColor: "#3498db" },
  methodLabel: { fontSize: 14, color: "#666", marginBottom: 6 },
  methodValue: { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  methodCount: { fontSize: 12, color: "#888", marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  list: { paddingBottom: 28 },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  orderNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a2e",
    width: 50,
  },
  orderMid: { flex: 1, paddingRight: 8 },
  orderItems: { fontSize: 14, color: "#555" },
  orderMethod: { fontSize: 12, color: "#888", marginTop: 2 },
  orderPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#e74c3c",
    minWidth: 80,
    textAlign: "right",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 15,
    marginTop: 30,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    color: "#c0392b",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  closeBtn: {
    backgroundColor: "#e74c3c",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  closeBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
});
