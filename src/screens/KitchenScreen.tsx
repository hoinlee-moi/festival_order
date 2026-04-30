import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { useOrdersByStatus, useUpdateOrderStatus } from "../hooks/useOrders";
import { useRealtimeOrders } from "../hooks/useRealtimeOrders";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Order, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Kitchen">;

const getTodayString = () => new Date().toISOString().split("T")[0];

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function KitchenScreen({ navigation }: Props) {
  const {
    data: orders = [],
    isLoading,
    isError,
  } = useOrdersByStatus("PENDING", getTodayString());
  const updateStatus = useUpdateOrderStatus();
  useRealtimeOrders("PENDING");

  // 신규 주문 알림 사운드
  const prevCountRef = useRef(orders.length);
  useEffect(() => {
    if (orders.length > prevCountRef.current) {
      playNotification();
    }
    prevCountRef.current = orders.length;
  }, [orders.length]);

  const playNotification = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/notification.wav"),
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch {
      // 사운드 파일 없으면 무시
    }
  };

  const handleComplete = (order: Order) => {
    updateStatus.mutate(
      { id: order.id, status: "READY" },
      {
        onError: () => {
          Alert.alert(
            "오류",
            "요리 완료 처리에 실패했습니다. 네트워크 연결을 확인하세요.",
          );
        },
      },
    );
  };

  const renderOrderCard = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      {/* 대기번호 */}
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>#{item.order_number}</Text>
      </View>

      <Text style={styles.phoneText}>{formatPhone(item.phone_number)}</Text>

      {/* 메뉴 목록 */}
      <View style={styles.itemsList}>
        {item.items.map((menuItem, idx) => (
          <View key={idx} style={styles.menuRow}>
            <Text style={styles.menuItemName}>{menuItem.menuName}</Text>
            <Text style={styles.menuItemQty}>{menuItem.quantity}</Text>
          </View>
        ))}
      </View>

      {/* 요리 완료 버튼 */}
      <TouchableOpacity
        style={styles.completeBtn}
        activeOpacity={0.7}
        onPress={() => handleComplete(item)}
      >
        <Text style={styles.completeBtnText}>✅ 요리 완료</Text>
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>🍳 주방</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>오늘 {orders.length}건 대기</Text>
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
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyText}>오늘 대기 중인 주문이 없습니다</Text>
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
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  // 헤더
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#16213e",
  },
  backBtn: { fontSize: 14, color: "#aaa", fontWeight: "600", marginRight: 12 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff", flex: 1 },
  badge: {
    backgroundColor: "#e74c3c",
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
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  // 대기번호
  numberBadge: {
    backgroundColor: "#1a1a2e",
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 10,
  },
  numberText: { fontSize: 32, fontWeight: "900", color: "#ffd460" },
  phoneText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#666",
    marginBottom: 14,
  },
  // 메뉴 아이템
  itemsList: { marginBottom: 18 },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemName: { flex: 1, fontSize: 30, fontWeight: "900", color: "#222" },
  menuItemQty: {
    minWidth: 72,
    textAlign: "right",
    fontSize: 34,
    fontWeight: "900",
    color: "#e74c3c",
  },
  // 완료 버튼
  completeBtn: {
    backgroundColor: "#2ecc71",
    paddingVertical: 17,
    borderRadius: 12,
    alignItems: "center",
  },
  completeBtnText: { fontSize: 20, fontWeight: "800", color: "#fff" },
});
