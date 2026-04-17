import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMenus, useRefreshMenus } from "../hooks/useMenus";
import {
  useCreateOrder,
  useOrdersByStatus,
  useUpdateOrderStatus,
  useSalesSummary,
} from "../hooks/useOrders";
import { useRealtimeOrders } from "../hooks/useRealtimeOrders";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CartItem, Menu, Order, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Counter">;

// ===== 탭 종류 =====
type Tab = "order" | "recent" | "sales";

export default function CounterScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  // 데이터
  const { data: menus = [], isLoading: menusLoading } = useMenus();
  const refreshMenus = useRefreshMenus();
  const { data: pendingOrders = [] } = useOrdersByStatus("PENDING");
  const { data: salesSummary } = useSalesSummary();
  const createOrder = useCreateOrder();
  const updateStatus = useUpdateOrderStatus();

  useRealtimeOrders(["PENDING", "READY", "COMPLETED"]);

  // 로컬 상태
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("order");
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState("");
  const [receivedCash, setReceivedCash] = useState("");

  // ===== 장바구니 로직 =====
  const totalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const addToCart = useCallback((menu: Menu) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuId === menu.id);
      if (existing) {
        return prev.map((c) =>
          c.menuId === menu.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          menuId: menu.id,
          menuName: menu.name,
          price: menu.price,
          quantity: 1,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((menuId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuId === menuId ? { ...c, quantity: c.quantity + delta } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  // ===== 주문 접수 =====
  const nextOrderNumber = useMemo(() => {
    if (pendingOrders.length === 0) return 1;
    const allOrders = pendingOrders;
    const max = Math.max(...allOrders.map((o) => o.order_number));
    return max + 1;
  }, [pendingOrders]);

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      Alert.alert("알림", "메뉴를 선택해주세요.");
      return;
    }
    setPhone("");
    setReceivedCash("");
    setShowModal(true);
  };

  const validatePhone = (num: string) => /^010\d{8}$/.test(num);

  const handleSubmitOrder = async () => {
    if (!validatePhone(phone)) {
      Alert.alert("오류", "올바른 전화번호를 입력하세요. (010XXXXXXXX)");
      return;
    }
    try {
      await createOrder.mutateAsync({
        phone_number: phone,
        items: cart.map((c) => ({
          menuName: c.menuName,
          quantity: c.quantity,
          price: c.price,
        })),
        total_price: totalPrice,
      });
      clearCart();
      setShowModal(false);
      Alert.alert("완료", "주문이 접수되었습니다!");
    } catch {
      Alert.alert("오류", "주문 접수에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleCancelOrder = (order: Order) => {
    Alert.alert("주문 취소", `대기번호 ${order.order_number}번을 취소할까요?`, [
      { text: "아니요", style: "cancel" },
      {
        text: "취소하기",
        style: "destructive",
        onPress: () =>
          updateStatus.mutate({ id: order.id, status: "CANCELLED" }),
      },
    ]);
  };

  // ===== 거스름돈 =====
  const cashNum = parseInt(receivedCash, 10) || 0;
  const change = cashNum - totalPrice;

  // ===== 렌더 =====
  const renderMenuGrid = () => (
    <View style={styles.menuSection}>
      <View style={styles.menuHeader}>
        <Text style={styles.sectionTitle}>메뉴</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshMenus}>
          <Text style={styles.refreshBtnText}>🔄 새로고침</Text>
        </TouchableOpacity>
      </View>
      {menusLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <View
          style={[styles.menuList, { flexDirection: "row", flexWrap: "wrap" }]}
        >
          {menus.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, { width: isWide ? "33%" : "48%" }]}
              activeOpacity={0.7}
              onPress={() => addToCart(item)}
            >
              <Text style={styles.menuName}>{item.name}</Text>
              <Text style={styles.menuPrice}>
                {item.price.toLocaleString()}원
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderCart = () => (
    <View style={styles.cartSection}>
      <Text style={styles.sectionTitle}>주문 내역</Text>
      {cart.length === 0 ? (
        <Text style={styles.emptyText}>메뉴를 터치하여 추가하세요</Text>
      ) : (
        <ScrollView style={styles.cartList}>
          {cart.map((item) => (
            <View key={item.menuId} style={styles.cartItem}>
              <Text style={styles.cartItemName}>{item.menuName}</Text>
              <View style={styles.cartQtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.menuId, -1)}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.cartQty}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.menuId, 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cartItemPrice}>
                {(item.price * item.quantity).toLocaleString()}원
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={styles.cartFooter}>
        <Text style={styles.totalLabel}>합계</Text>
        <Text style={styles.totalPrice}>{totalPrice.toLocaleString()}원</Text>
      </View>
      <View style={styles.cartActions}>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={clearCart}
          disabled={cart.length === 0}
        >
          <Text style={styles.clearBtnText}>초기화</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutBtn, cart.length === 0 && styles.btnDisabled]}
          onPress={handleOpenCheckout}
          disabled={cart.length === 0}
        >
          <Text style={styles.checkoutBtnText}>주문 접수</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRecentOrders = () => (
    <View style={styles.recentSection}>
      <Text style={styles.sectionTitle}>최근 주문 (PENDING)</Text>
      {pendingOrders.length === 0 ? (
        <Text style={styles.emptyText}>대기 중인 주문이 없습니다</Text>
      ) : (
        <FlatList
          data={[...pendingOrders].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.recentCard}>
              <View style={styles.recentInfo}>
                <Text style={styles.recentNumber}>#{item.order_number}</Text>
                <Text style={styles.recentItems}>
                  {item.items
                    .map((i) => `${i.menuName}×${i.quantity}`)
                    .join(", ")}
                </Text>
                <Text style={styles.recentTotal}>
                  {item.total_price.toLocaleString()}원
                </Text>
              </View>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => handleCancelOrder(item)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderSales = () => (
    <View style={styles.salesSection}>
      <Text style={styles.sectionTitle}>당일 매출</Text>
      <View style={styles.salesCard}>
        <View style={styles.salesRow}>
          <Text style={styles.salesLabel}>총 매출액</Text>
          <Text style={styles.salesValue}>
            {(salesSummary?.totalRevenue ?? 0).toLocaleString()}원
          </Text>
        </View>
        <View style={styles.salesDivider} />
        <View style={styles.salesRow}>
          <Text style={styles.salesLabel}>총 주문 건수</Text>
          <Text style={styles.salesValue}>
            {salesSummary?.totalOrders ?? 0}건
          </Text>
        </View>
      </View>
    </View>
  );

  // ===== 와이드(태블릿): 좌측 메뉴 + 우측 장바구니, 하단 탭으로 최근주문/매출 =====
  // ===== 좁은(폰): 탭 전환 =====
  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("RoleSelect")}>
          <Text style={styles.backBtn}>← 처음으로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🧾 카운터</Text>
        <Text style={styles.headerOrderNum}>
          다음 대기번호: #{nextOrderNumber}
        </Text>
      </View>

      {isWide ? (
        /* === 태블릿 레이아웃 === */
        <View style={styles.wideBody}>
          <View style={styles.wideLeft}>{renderMenuGrid()}</View>
          <View style={styles.wideRight}>
            {renderCart()}
            {/* 탭 영역 */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "recent" && styles.tabActive]}
                onPress={() => setActiveTab("recent")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "recent" && styles.tabTextActive,
                  ]}
                >
                  최근 주문
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "sales" && styles.tabActive]}
                onPress={() => setActiveTab("sales")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "sales" && styles.tabTextActive,
                  ]}
                >
                  매출
                </Text>
              </TouchableOpacity>
            </View>
            {activeTab === "recent" ? renderRecentOrders() : renderSales()}
          </View>
        </View>
      ) : (
        /* === 모바일 레이아웃 === */
        <View style={{ flex: 1 }}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "order" && styles.tabActive]}
              onPress={() => setActiveTab("order")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "order" && styles.tabTextActive,
                ]}
              >
                주문
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "recent" && styles.tabActive]}
              onPress={() => setActiveTab("recent")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "recent" && styles.tabTextActive,
                ]}
              >
                최근 주문
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "sales" && styles.tabActive]}
              onPress={() => setActiveTab("sales")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "sales" && styles.tabTextActive,
                ]}
              >
                매출
              </Text>
            </TouchableOpacity>
          </View>
          {activeTab === "order" && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {renderMenuGrid()}
              {renderCart()}
            </ScrollView>
          )}
          {activeTab === "recent" && renderRecentOrders()}
          {activeTab === "sales" && renderSales()}
        </View>
      )}

      {/* ===== 결제 모달 ===== */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>주문 확인</Text>

            {/* 주문 요약 */}
            <View style={styles.modalSummary}>
              {cart.map((item) => (
                <Text key={item.menuId} style={styles.modalItem}>
                  {item.menuName} × {item.quantity} ={" "}
                  {(item.price * item.quantity).toLocaleString()}원
                </Text>
              ))}
              <Text style={styles.modalTotal}>
                합계: {totalPrice.toLocaleString()}원
              </Text>
            </View>

            {/* 전화번호 입력 */}
            <Text style={styles.inputLabel}>전화번호</Text>
            <TextInput
              style={styles.input}
              placeholder="01012345678"
              keyboardType="phone-pad"
              maxLength={11}
              value={phone}
              onChangeText={setPhone}
            />

            {/* 거스름돈 계산 */}
            <Text style={styles.inputLabel}>받은 금액</Text>
            <TextInput
              style={styles.input}
              placeholder="금액 입력"
              keyboardType="number-pad"
              value={receivedCash}
              onChangeText={setReceivedCash}
            />
            <View style={styles.cashShortcuts}>
              <TouchableOpacity
                style={styles.cashBtn}
                onPress={() =>
                  setReceivedCash((prev) =>
                    String((parseInt(prev, 10) || 0) + 10000),
                  )
                }
              >
                <Text style={styles.cashBtnText}>+1만원</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cashBtn}
                onPress={() =>
                  setReceivedCash((prev) =>
                    String((parseInt(prev, 10) || 0) + 50000),
                  )
                }
              >
                <Text style={styles.cashBtnText}>5만원</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cashBtn}
                onPress={() => setReceivedCash(String(totalPrice))}
              >
                <Text style={styles.cashBtnText}>금액 맞음</Text>
              </TouchableOpacity>
            </View>
            {cashNum > 0 && (
              <Text
                style={[styles.changeText, change < 0 && styles.changeNegative]}
              >
                거스름돈:{" "}
                {change >= 0 ? `${change.toLocaleString()}원` : "부족"}
              </Text>
            )}

            {/* 대기번호 */}
            <Text style={styles.nextNumber}>대기번호 #{nextOrderNumber}</Text>

            {/* 버튼 */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  createOrder.isPending && styles.btnDisabled,
                ]}
                onPress={handleSubmitOrder}
                disabled={createOrder.isPending}
              >
                <Text style={styles.modalSubmitText}>
                  {createOrder.isPending ? "처리 중..." : "주문 접수"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ===== 스타일 =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", paddingBottom: 24 },
  // 헤더
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
  headerOrderNum: { fontSize: 16, fontWeight: "600", color: "#ffd460" },
  // 태블릿 레이아웃
  wideBody: { flex: 1, flexDirection: "row" },
  wideLeft: { flex: 3, borderRightWidth: 1, borderRightColor: "#e0e0e0" },
  wideRight: { flex: 2 },
  // 탭
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: "#1a1a2e" },
  tabText: { fontSize: 15, color: "#999", fontWeight: "600" },
  tabTextActive: { color: "#1a1a2e" },
  // 메뉴 섹션
  menuSection: { flex: 1, padding: 12 },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#333" },
  refreshBtn: {
    backgroundColor: "#e8e8e8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnText: { fontSize: 13, color: "#555" },
  menuList: { paddingBottom: 8, gap: 8, justifyContent: "space-between" },
  menuCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuName: { fontSize: 17, fontWeight: "700", color: "#333", marginBottom: 4 },
  menuPrice: { fontSize: 15, fontWeight: "600", color: "#e74c3c" },
  // 장바구니
  cartSection: { padding: 12 },
  emptyText: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },
  cartList: { maxHeight: 180 },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  cartItemName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#333" },
  cartQtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e8e8e8",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnText: { fontSize: 18, fontWeight: "700", color: "#333" },
  cartQty: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  cartItemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    minWidth: 70,
    textAlign: "right",
  },
  cartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginTop: 8,
  },
  totalLabel: { fontSize: 18, fontWeight: "700", color: "#333" },
  totalPrice: { fontSize: 22, fontWeight: "800", color: "#e74c3c" },
  cartActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 16, fontWeight: "700", color: "#555" },
  checkoutBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  checkoutBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
  // 최근 주문
  recentSection: { flex: 1, padding: 12 },
  recentCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  recentInfo: { flex: 1 },
  recentNumber: { fontSize: 20, fontWeight: "800", color: "#1a1a2e" },
  recentItems: { fontSize: 13, color: "#666", marginTop: 2 },
  recentTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e74c3c",
    marginTop: 2,
  },
  cancelBtn: {
    backgroundColor: "#ff4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // 매출
  salesSection: { flex: 1, padding: 12 },
  salesCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  salesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  salesLabel: { fontSize: 16, color: "#666" },
  salesValue: { fontSize: 24, fontWeight: "800", color: "#1a1a2e" },
  salesDivider: { height: 1, backgroundColor: "#e8e8e8" },
  // 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 16,
  },
  modalSummary: {
    backgroundColor: "#f8f8f8",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalItem: { fontSize: 14, color: "#555", marginBottom: 4 },
  modalTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e74c3c",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  cashShortcuts: { flexDirection: "row", gap: 8, marginBottom: 8 },
  cashBtn: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  cashBtnText: { fontSize: 13, fontWeight: "600", color: "#555" },
  changeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2ecc71",
    marginBottom: 12,
  },
  changeNegative: { color: "#e74c3c" },
  nextNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a2e",
    textAlign: "center",
    marginVertical: 12,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 16, fontWeight: "700", color: "#555" },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  modalSubmitText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
