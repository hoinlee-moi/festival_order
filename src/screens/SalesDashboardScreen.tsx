import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types";
import { useSalesSummary, useOrdersByStatus } from "../hooks/useOrders";
import { useRealtimeOrders } from "../hooks/useRealtimeOrders";
import type { Order } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "SalesDashboard">;

export default function SalesDashboardScreen({ navigation }: Props) {
  const { data: salesSummary, isLoading } = useSalesSummary();
  const { data: completedOrders = [] } = useOrdersByStatus("COMPLETED");
  useRealtimeOrders(["PENDING", "READY", "COMPLETED"]);

  const renderCompletedOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderRow}>
      <Text style={styles.orderNum}>#{item.order_number}</Text>
      <Text style={styles.orderItems}>
        {item.items.map((i) => `${i.menuName}×${i.quantity}`).join(", ")}
      </Text>
      <Text style={styles.orderPrice}>
        {item.total_price.toLocaleString()}원
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← 돌아가기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 매출 조회</Text>
        <View style={{ width: 80 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 60 }} />
      ) : (
        <View style={styles.body}>
          {/* 매출 요약 카드 */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>총 매출액</Text>
              <Text style={styles.summaryValue}>
                {(salesSummary?.totalRevenue ?? 0).toLocaleString()}원
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>총 주문 건수</Text>
              <Text style={styles.summaryValue}>
                {salesSummary?.totalOrders ?? 0}건
              </Text>
            </View>
          </View>

          {/* 완료된 주문 목록 */}
          <Text style={styles.sectionTitle}>완료된 주문 내역</Text>
          <FlatList
            data={[...completedOrders].reverse()}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={renderCompletedOrder}
            ListEmptyComponent={
              <Text style={styles.emptyText}>완료된 주문이 없습니다</Text>
            }
          />
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
  body: { flex: 1, padding: 16 },
  // 요약 카드
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryLabel: { fontSize: 14, color: "#888", marginBottom: 8 },
  summaryValue: { fontSize: 26, fontWeight: "800", color: "#1a1a2e" },
  // 완료 주문 리스트
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  list: { paddingBottom: 20 },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  orderNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a2e",
    width: 50,
  },
  orderItems: { flex: 1, fontSize: 14, color: "#555" },
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
});
