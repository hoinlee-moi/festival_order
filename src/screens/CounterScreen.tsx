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
  useOrdersByDate,
  useOrdersByStatus,
  useUpdateOrderPhone,
  useUpdateOrderStatus,
} from "../hooks/useOrders";
import { useRealtimeOrders } from "../hooks/useRealtimeOrders";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  CartItem,
  Menu,
  Order,
  PaymentMethod,
  RootStackParamList,
} from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Counter">;

// ===== 탭 종류 =====
type Tab = "order" | "recent";

const getTodayString = () => new Date().toISOString().split("T")[0];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${month}.${day} (${weekday})`;
};

const shiftDate = (dateString: string, days: number) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const WAITING_PHONE = "00000000000";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value || "전화번호 없음";
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export default function CounterScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const isTabletPortrait = isWide && height > width;

  // 데이터
  const {
    data: menus = [],
    isLoading: menusLoading,
    isError: menusError,
  } = useMenus();
  const refreshMenus = useRefreshMenus();
  const { data: sessionOrders = [], isError: sessionOrdersError } =
    useOrdersByStatus(["PENDING", "READY", "COMPLETED", "CANCELLED"]);
  const [recentDate, setRecentDate] = useState(getTodayString());
  const { data: recentOrders = [], isError: recentOrdersError } =
    useOrdersByDate(recentDate);
  const createOrder = useCreateOrder();
  const updateStatus = useUpdateOrderStatus();
  const updatePhone = useUpdateOrderPhone();

  useRealtimeOrders(["PENDING", "READY", "COMPLETED"]);

  // 로컬 상태
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("order");
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState("");
  const [receivedCash, setReceivedCash] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [phoneEditOrder, setPhoneEditOrder] = useState<Order | null>(null);
  const [editingPhone, setEditingPhone] = useState("");

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
    if (sessionOrders.length === 0) return 1;
    const max = Math.max(...sessionOrders.map((o) => o.order_number));
    return max + 1;
  }, [sessionOrders]);

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      Alert.alert("알림", "메뉴를 선택해주세요.");
      return;
    }
    setPhone("010");
    setReceivedCash("");
    setPaymentMethod("CASH");
    setShowModal(true);
  };

  const validatePhone = (num: string) => {
    const digits = num.replace(/\D/g, "");
    return /^010\d{8}$/.test(digits) || digits === WAITING_PHONE;
  };

  const normalizePhone = (num: string) => num.replace(/\D/g, "");

  const openPhoneEditor = (order: Order) => {
    setPhoneEditOrder(order);
    setEditingPhone(order.phone_number || "010");
  };

  const closePhoneEditor = () => {
    setPhoneEditOrder(null);
    setEditingPhone("");
  };

  const handleUpdatePhone = async () => {
    if (!phoneEditOrder) return;

    const nextPhone = normalizePhone(editingPhone);
    if (!validatePhone(nextPhone)) {
      Alert.alert("오류", "010XXXXXXXX 또는 00000000000 형식으로 입력하세요.");
      return;
    }

    try {
      await updatePhone.mutateAsync({
        id: phoneEditOrder.id,
        phone_number: nextPhone,
      });
      closePhoneEditor();
      Alert.alert("완료", "전화번호가 수정되었습니다.");
    } catch {
      Alert.alert("오류", "전화번호 수정에 실패했습니다.");
    }
  };

  const handleSubmitOrder = async (options?: {
    status?: Order["status"];
    requirePhone?: boolean;
  }) => {
    const status = options?.status ?? "PENDING";
    const requirePhone = options?.requirePhone ?? true;

    const normalizedPhone = normalizePhone(phone);

    if (requirePhone && !validatePhone(normalizedPhone)) {
      Alert.alert("오류", "010XXXXXXXX 또는 00000000000 형식으로 입력하세요.");
      return;
    }
    if (paymentMethod === "CASH") {
      const cash = parseInt(receivedCash, 10) || 0;
      if (cash < totalPrice) {
        Alert.alert("오류", "받은 금액이 부족합니다.");
        return;
      }
    }
    try {
      await createOrder.mutateAsync({
        phone_number: requirePhone ? normalizedPhone : "",
        items: cart.map((c) => ({
          menuName: c.menuName,
          quantity: c.quantity,
          price: c.price,
        })),
        total_price: totalPrice,
        payment_method: paymentMethod,
        status,
      });
      clearCart();
      setShowModal(false);
      Alert.alert(
        "완료",
        status === "COMPLETED"
          ? "주문이 즉시 완료 처리되었습니다!"
          : "주문이 접수되었습니다!",
      );
    } catch {
      Alert.alert("오류", "주문 접수에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleImmediateComplete = () => {
    Alert.alert(
      "즉시 완료",
      "이 주문을 주방으로 넘기지 않고 즉시 완료 처리할까요?",
      [
        { text: "아니요", style: "cancel" },
        {
          text: "즉시 완료",
          onPress: () =>
            handleSubmitOrder({ status: "COMPLETED", requirePhone: false }),
        },
      ],
    );
  };

  const handleCancelOrder = (order: Order) => {
    Alert.alert("주문 취소", `대기번호 ${order.order_number}번을 취소할까요?`, [
      { text: "아니요", style: "cancel" },
      {
        text: "취소하기",
        style: "destructive",
        onPress: () =>
          updateStatus.mutate(
            { id: order.id, status: "CANCELLED" },
            {
              onError: () => {
                Alert.alert(
                  "오류",
                  "주문 취소에 실패했습니다. 네트워크 연결을 확인하세요.",
                );
              },
            },
          ),
      },
    ]);
  };

  const getStatusLabel = (status: Order["status"]) => {
    if (status === "PENDING") return "대기";
    if (status === "READY") return "준비완료";
    if (status === "COMPLETED") return "완료";
    return "취소";
  };

  // ===== 거스름돈 =====
  const cashNum = parseInt(receivedCash, 10) || 0;
  const change = cashNum - totalPrice;

  // ===== 렌더 =====
  const renderMenuGrid = () => (
    <View style={styles.menuSection}>
      <View style={styles.menuHeader}>
        <Text style={[styles.sectionTitle, isWide && styles.sectionTitleWide]}>
          메뉴
        </Text>
        <TouchableOpacity
          style={[styles.refreshBtn, isWide && styles.refreshBtnWide]}
          onPress={refreshMenus}
        >
          <Text
            style={[styles.refreshBtnText, isWide && styles.refreshBtnTextWide]}
          >
            🔄 새로고침
          </Text>
        </TouchableOpacity>
      </View>
      {menusError && (
        <Text style={styles.errorText}>
          메뉴를 불러오지 못했습니다. 네트워크 연결을 확인하세요.
        </Text>
      )}
      {menusLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.menuList}>
          {menus.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuCard,
                isWide && styles.menuCardWide,
                { width: isWide ? "48%" : "48%" },
              ]}
              activeOpacity={0.7}
              onPress={() => addToCart(item)}
            >
              <Text style={[styles.menuName, isWide && styles.menuNameWide]}>
                {item.name}
              </Text>
              <Text style={[styles.menuPrice, isWide && styles.menuPriceWide]}>
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
      <Text style={[styles.sectionTitle, isWide && styles.sectionTitleWide]}>
        주문 내역
      </Text>
      {cart.length === 0 ? (
        <Text style={[styles.emptyText, isWide && styles.emptyTextWide]}>
          메뉴를 터치하여 추가하세요
        </Text>
      ) : (
        <View
          style={[
            styles.cartListFrame,
            {
              maxHeight: isWide
                ? Math.max(260, height * 0.42)
                : Math.max(160, height * 0.32),
            },
          ]}
        >
          <ScrollView
            style={styles.cartList}
            contentContainerStyle={styles.cartListContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {cart.map((item) => (
              <View
                key={item.menuId}
                style={[
                  styles.cartItem,
                  isWide && styles.cartItemWide,
                  isTabletPortrait && styles.cartItemStacked,
                ]}
              >
                <Text
                  style={[
                    styles.cartItemName,
                    isWide && styles.cartItemNameWide,
                    isTabletPortrait && styles.cartItemNameStacked,
                  ]}
                >
                  {item.menuName}
                </Text>
                <View
                  style={[
                    styles.cartItemBottom,
                    isTabletPortrait && styles.cartItemBottomStacked,
                  ]}
                >
                  <View
                    style={[styles.cartQtyRow, isWide && styles.cartQtyRowWide]}
                  >
                    <TouchableOpacity
                      style={[styles.qtyBtn, isWide && styles.qtyBtnWide]}
                      onPress={() => updateQuantity(item.menuId, -1)}
                    >
                      <Text
                        style={[
                          styles.qtyBtnText,
                          isWide && styles.qtyBtnTextWide,
                        ]}
                      >
                        −
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[styles.cartQty, isWide && styles.cartQtyWide]}
                    >
                      {item.quantity}
                    </Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, isWide && styles.qtyBtnWide]}
                      onPress={() => updateQuantity(item.menuId, 1)}
                    >
                      <Text
                        style={[
                          styles.qtyBtnText,
                          isWide && styles.qtyBtnTextWide,
                        ]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text
                    style={[
                      styles.cartItemPrice,
                      isWide && styles.cartItemPriceWide,
                      isTabletPortrait && styles.cartItemPriceStacked,
                    ]}
                  >
                    {(item.price * item.quantity).toLocaleString()}원
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={styles.cartFooter}>
        <Text style={[styles.totalLabel, isWide && styles.totalLabelWide]}>
          합계
        </Text>
        <Text style={[styles.totalPrice, isWide && styles.totalPriceWide]}>
          {totalPrice.toLocaleString()}원
        </Text>
      </View>
      <View style={styles.cartActions}>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={clearCart}
          disabled={cart.length === 0}
        >
          <Text
            style={[styles.clearBtnText, isWide && styles.actionBtnTextWide]}
          >
            초기화
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutBtn, cart.length === 0 && styles.btnDisabled]}
          onPress={handleOpenCheckout}
          disabled={cart.length === 0}
        >
          <Text
            style={[styles.checkoutBtnText, isWide && styles.actionBtnTextWide]}
          >
            주문 접수
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRecentOrders = () => (
    <View style={styles.recentSection}>
      <View style={styles.recentHeaderRow}>
        <Text style={styles.sectionTitle}>날짜별 주문</Text>
        <TouchableOpacity
          style={styles.todaySmallBtn}
          onPress={() => setRecentDate(getTodayString())}
        >
          <Text style={styles.todaySmallBtnText}>오늘</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dateSelectorRow}>
        <TouchableOpacity
          style={styles.dateMoveBtn}
          onPress={() => setRecentDate((date) => shiftDate(date, -1))}
        >
          <Text style={styles.dateMoveBtnText}>이전</Text>
        </TouchableOpacity>
        <Text style={styles.dateSelectorText}>{formatDate(recentDate)}</Text>
        <TouchableOpacity
          style={styles.dateMoveBtn}
          onPress={() => setRecentDate((date) => shiftDate(date, 1))}
        >
          <Text style={styles.dateMoveBtnText}>다음</Text>
        </TouchableOpacity>
      </View>
      {recentOrdersError ? (
        <Text style={styles.errorText}>
          주문 목록을 불러오지 못했습니다. 네트워크 연결을 확인하세요.
        </Text>
      ) : recentOrders.length === 0 ? (
        <Text style={styles.emptyText}>해당 날짜의 주문이 없습니다</Text>
      ) : (
        <FlatList
          data={recentOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.recentList}
          renderItem={({ item }) => (
            <View style={styles.recentCard}>
              <View style={styles.recentInfo}>
                <View style={styles.recentTopRow}>
                  <Text style={styles.recentNumber}>#{item.order_number}</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      item.status === "PENDING" && styles.statusPending,
                      item.status === "READY" && styles.statusReady,
                      item.status === "COMPLETED" && styles.statusCompleted,
                      item.status === "CANCELLED" && styles.statusCancelled,
                    ]}
                  >
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
                <Text style={styles.recentItems}>
                  {item.items
                    .map((i) => `${i.menuName}×${i.quantity}`)
                    .join(", ")}
                </Text>
                <View style={styles.recentPhoneRow}>
                  <Text style={styles.recentPhone}>
                    {formatPhone(item.phone_number)}
                  </Text>
                  <TouchableOpacity
                    style={styles.phoneEditBtn}
                    onPress={() => openPhoneEditor(item)}
                  >
                    <Text style={styles.phoneEditBtnText}>번호 수정</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.recentTotal}>
                  {item.total_price.toLocaleString()}원
                </Text>
              </View>
              {item.status !== "CANCELLED" && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => handleCancelOrder(item)}
                >
                  <Text style={styles.cancelBtnText}>취소</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );

  const renderOrderScreen = () =>
    isWide ? (
      <View style={styles.wideBody}>
        <View style={styles.wideLeft}>{renderMenuGrid()}</View>
        <View style={styles.wideRight}>{renderCart()}</View>
      </View>
    ) : (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        nestedScrollEnabled
      >
        {renderMenuGrid()}
        {renderCart()}
      </ScrollView>
    );

  // ===== 카운터: 주문 / 최근 주문 탭 =====
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
        <Text style={styles.headerTitle}>🧾 카운터</Text>
        <Text style={styles.headerOrderNum}>
          {sessionOrdersError
            ? "대기번호 확인 불가"
            : `다음 대기번호: #${nextOrderNumber}`}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tab,
              isWide && styles.tabWide,
              activeTab === "order" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("order")}
          >
            <Text
              style={[
                styles.tabText,
                isWide && styles.tabTextWide,
                activeTab === "order" && styles.tabTextActive,
              ]}
            >
              주문
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              isWide && styles.tabWide,
              activeTab === "recent" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("recent")}
          >
            <Text
              style={[
                styles.tabText,
                isWide && styles.tabTextWide,
                activeTab === "recent" && styles.tabTextActive,
              ]}
            >
              최근 주문
            </Text>
          </TouchableOpacity>
        </View>
        {activeTab === "order" ? renderOrderScreen() : renderRecentOrders()}
      </View>

      {/* ===== 결제 모달 ===== */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              isWide && styles.modalContentWide,
              { maxHeight: height * 0.9 },
            ]}
          >
            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[styles.modalTitle, isWide && styles.modalTitleWide]}
              >
                주문 확인
              </Text>

              {/* 주문 요약 */}
              <View style={styles.modalSummary}>
                {cart.map((item) => (
                  <Text
                    key={item.menuId}
                    style={[styles.modalItem, isWide && styles.modalItemWide]}
                  >
                    {item.menuName} × {item.quantity} ={" "}
                    {(item.price * item.quantity).toLocaleString()}원
                  </Text>
                ))}
                <Text
                  style={[styles.modalTotal, isWide && styles.modalTotalWide]}
                >
                  합계: {totalPrice.toLocaleString()}원
                </Text>
              </View>

              {/* 전화번호 입력 */}
              <Text
                style={[styles.inputLabel, isWide && styles.inputLabelWide]}
              >
                전화번호
              </Text>
              <View style={styles.phoneInputRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.phoneInput,
                    isWide && styles.inputWide,
                  ]}
                  placeholder="01012345678"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={phone}
                  onChangeText={setPhone}
                />
                <TouchableOpacity
                  style={[
                    styles.waitingPhoneBtn,
                    isWide && styles.waitingPhoneBtnWide,
                  ]}
                  onPress={() => setPhone(WAITING_PHONE)}
                >
                  <Text
                    style={[
                      styles.waitingPhoneBtnText,
                      isWide && styles.waitingPhoneBtnTextWide,
                    ]}
                  >
                    대기
                  </Text>
                  <Text
                    style={[
                      styles.waitingPhoneSubText,
                      isWide && styles.waitingPhoneSubTextWide,
                    ]}
                  >
                    000-0000-0000
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 결제 수단 선택 */}
              <Text
                style={[styles.inputLabel, isWide && styles.inputLabelWide]}
              >
                결제 수단
              </Text>
              <View style={styles.payTabRow}>
                <TouchableOpacity
                  style={[
                    styles.payTab,
                    styles.payTabCash,
                    paymentMethod === "CASH" && styles.payTabActive,
                  ]}
                  onPress={() => setPaymentMethod("CASH")}
                >
                  <Text
                    style={[
                      styles.payTabIcon,
                      isWide && styles.payTabIconWide,
                      paymentMethod === "CASH" && styles.payTabTextActive,
                    ]}
                  >
                    💵
                  </Text>
                  <Text
                    style={[
                      styles.payTabText,
                      isWide && styles.payTabTextWide,
                      paymentMethod === "CASH" && styles.payTabTextActive,
                    ]}
                  >
                    현금
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.payTab,
                    styles.payTabCard,
                    paymentMethod === "CARD" && styles.payTabActive,
                  ]}
                  onPress={() => setPaymentMethod("CARD")}
                >
                  <Text
                    style={[
                      styles.payTabIcon,
                      isWide && styles.payTabIconWide,
                      paymentMethod === "CARD" && styles.payTabTextActive,
                    ]}
                  >
                    💳
                  </Text>
                  <Text
                    style={[
                      styles.payTabText,
                      isWide && styles.payTabTextWide,
                      paymentMethod === "CARD" && styles.payTabTextActive,
                    ]}
                  >
                    카드
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 거스름돈 계산 (현금 결제 시만) */}
              <View style={styles.cashDetailsSlot}>
                {paymentMethod === "CASH" ? (
                  <>
                    <Text
                      style={[
                        styles.inputLabel,
                        isWide && styles.inputLabelWide,
                      ]}
                    >
                      받은 금액
                    </Text>
                    <TextInput
                      style={[styles.input, isWide && styles.inputWide]}
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
                        <Text
                          style={[
                            styles.cashBtnText,
                            isWide && styles.cashBtnTextWide,
                          ]}
                        >
                          +1만원
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cashBtn}
                        onPress={() =>
                          setReceivedCash((prev) =>
                            String((parseInt(prev, 10) || 0) + 50000),
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.cashBtnText,
                            isWide && styles.cashBtnTextWide,
                          ]}
                        >
                          5만원
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cashBtn}
                        onPress={() => setReceivedCash(String(totalPrice))}
                      >
                        <Text
                          style={[
                            styles.cashBtnText,
                            isWide && styles.cashBtnTextWide,
                          ]}
                        >
                          금액 맞음
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {cashNum > 0 ? (
                      <Text
                        style={[
                          styles.changeText,
                          isWide && styles.changeTextWide,
                          change < 0 && styles.changeNegative,
                        ]}
                      >
                        거스름돈:
                        {change >= 0 ? `${change.toLocaleString()}원` : "부족"}
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.changeTextPlaceholder,
                          isWide && styles.changeTextWide,
                        ]}
                      >
                        {" "}
                      </Text>
                    )}
                  </>
                ) : null}
              </View>

              {/* 대기번호 */}
              <Text
                style={[styles.nextNumber, isWide && styles.nextNumberWide]}
              >
                대기번호 #{nextOrderNumber}
              </Text>
            </ScrollView>

            {/* 버튼 */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    isWide && styles.modalButtonTextWide,
                  ]}
                >
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  createOrder.isPending && styles.btnDisabled,
                ]}
                onPress={() =>
                  handleSubmitOrder({ status: "PENDING", requirePhone: true })
                }
                disabled={createOrder.isPending}
              >
                <Text
                  style={[
                    styles.modalSubmitText,
                    isWide && styles.modalButtonTextWide,
                  ]}
                >
                  {createOrder.isPending ? "처리 중..." : "주방 접수"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalCompleteBtn,
                  createOrder.isPending && styles.btnDisabled,
                ]}
                onPress={handleImmediateComplete}
                disabled={createOrder.isPending}
              >
                <Text
                  style={[
                    styles.modalSubmitText,
                    isWide && styles.modalButtonTextWide,
                  ]}
                >
                  {createOrder.isPending ? "처리 중..." : "즉시 완료"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(phoneEditOrder)} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[styles.phoneEditModal, isWide && styles.phoneEditModalWide]}
          >
            <Text style={[styles.modalTitle, isWide && styles.modalTitleWide]}>
              전화번호 수정
            </Text>
            <Text style={[styles.inputLabel, isWide && styles.inputLabelWide]}>
              대기번호 #{phoneEditOrder?.order_number}
            </Text>
            <View style={styles.phoneInputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.phoneInput,
                  isWide && styles.inputWide,
                ]}
                placeholder="01012345678"
                keyboardType="phone-pad"
                maxLength={11}
                value={editingPhone}
                onChangeText={setEditingPhone}
              />
              <TouchableOpacity
                style={[
                  styles.waitingPhoneBtn,
                  isWide && styles.waitingPhoneBtnWide,
                ]}
                onPress={() => setEditingPhone(WAITING_PHONE)}
              >
                <Text
                  style={[
                    styles.waitingPhoneBtnText,
                    isWide && styles.waitingPhoneBtnTextWide,
                  ]}
                >
                  대기
                </Text>
                <Text
                  style={[
                    styles.waitingPhoneSubText,
                    isWide && styles.waitingPhoneSubTextWide,
                  ]}
                >
                  000-0000-0000
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.clearPhoneBtn, isWide && styles.clearPhoneBtnWide]}
              onPress={() => setEditingPhone("")}
            >
              <Text
                style={[
                  styles.clearPhoneBtnText,
                  isWide && styles.clearPhoneBtnTextWide,
                ]}
              >
                번호 전체 지우기
              </Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closePhoneEditor}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    isWide && styles.modalButtonTextWide,
                  ]}
                >
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  updatePhone.isPending && styles.btnDisabled,
                ]}
                onPress={handleUpdatePhone}
                disabled={updatePhone.isPending}
              >
                <Text
                  style={[
                    styles.modalSubmitText,
                    isWide && styles.modalButtonTextWide,
                  ]}
                >
                  {updatePhone.isPending ? "수정 중..." : "저장"}
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
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  // 헤더
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { fontSize: 15, color: "#ddd", fontWeight: "800" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#fff" },
  headerOrderNum: { fontSize: 17, fontWeight: "800", color: "#ffd460" },
  // 태블릿 레이아웃
  wideBody: { flex: 1, flexDirection: "row" },
  wideLeft: { flex: 3, borderRightWidth: 1, borderRightColor: "#e0e0e0" },
  wideRight: { flex: 2 },
  tabletBody: { flex: 1 },
  tabletOrderScroll: { flex: 1 },
  tabletOrderContent: { paddingBottom: 8 },
  tabletBottomPanel: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#f5f5f5",
  },
  // 탭
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabWide: { paddingVertical: 24 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: "#1a1a2e" },
  tabText: { fontSize: 17, color: "#888", fontWeight: "800" },
  tabTextWide: { fontSize: 42, fontWeight: "900" },
  tabTextActive: { color: "#1a1a2e" },
  // 메뉴 섹션
  menuSection: { flex: 1, padding: 12 },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 21, fontWeight: "900", color: "#222" },
  sectionTitleWide: { fontSize: 38 },
  refreshBtn: {
    backgroundColor: "#e8e8e8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnWide: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  refreshBtnText: { fontSize: 14, color: "#444", fontWeight: "800" },
  refreshBtnTextWide: { fontSize: 22, fontWeight: "900" },
  menuList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 8,
    paddingBottom: 8,
  },
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
  menuCardWide: {
    minHeight: 180,
    paddingVertical: 32,
    paddingHorizontal: 18,
    borderRadius: 18,
    justifyContent: "center",
  },
  menuName: { fontSize: 19, fontWeight: "900", color: "#222", marginBottom: 6 },
  menuNameWide: { fontSize: 34, marginBottom: 14 },
  menuPrice: { fontSize: 17, fontWeight: "800", color: "#e74c3c" },
  menuPriceWide: { fontSize: 28, fontWeight: "900" },
  // 장바구니
  cartSection: { padding: 12 },
  emptyText: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyTextWide: { fontSize: 28, fontWeight: "900", marginTop: 34 },
  errorText: {
    color: "#c0392b",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  cartListFrame: {
    borderRadius: 8,
    overflow: "hidden",
  },
  cartList: { flexGrow: 0 },
  cartListContent: { paddingBottom: 2 },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  cartItemWide: { padding: 18, borderRadius: 14, marginBottom: 12 },
  cartItemStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  cartItemName: { flex: 1, fontSize: 17, fontWeight: "900", color: "#222" },
  cartItemNameWide: { fontSize: 28 },
  cartItemNameStacked: {
    flex: 0,
    marginBottom: 14,
    lineHeight: 34,
  },
  cartItemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
  },
  cartItemBottomStacked: {
    justifyContent: "space-between",
    width: "100%",
  },
  cartQtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cartQtyRowWide: { gap: 14 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e8e8e8",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnWide: { width: 52, height: 52, borderRadius: 26 },
  qtyBtnText: { fontSize: 20, fontWeight: "900", color: "#222" },
  qtyBtnTextWide: { fontSize: 34 },
  cartQty: {
    fontSize: 18,
    fontWeight: "900",
    minWidth: 24,
    textAlign: "center",
  },
  cartQtyWide: { fontSize: 30, minWidth: 44 },
  cartItemPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#444",
    minWidth: 82,
    textAlign: "right",
  },
  cartItemPriceWide: { fontSize: 26, minWidth: 132 },
  cartItemPriceStacked: { textAlign: "right", minWidth: 150 },
  cartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginTop: 8,
  },
  totalLabel: { fontSize: 20, fontWeight: "900", color: "#222" },
  totalLabelWide: { fontSize: 34 },
  totalPrice: { fontSize: 25, fontWeight: "900", color: "#e74c3c" },
  totalPriceWide: { fontSize: 40 },
  cartActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },
  clearBtnText: { fontSize: 17, fontWeight: "900", color: "#555" },
  checkoutBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  checkoutBtnText: { fontSize: 18, fontWeight: "900", color: "#fff" },
  actionBtnTextWide: { fontSize: 30, fontWeight: "900" },
  btnDisabled: { opacity: 0.5 },
  // 최근 주문
  recentSection: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  todaySmallBtn: {
    backgroundColor: "#e8e8e8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  todaySmallBtnText: { fontSize: 14, color: "#444", fontWeight: "900" },
  dateSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  dateMoveBtn: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dateMoveBtnText: { fontSize: 15, color: "#444", fontWeight: "900" },
  dateSelectorText: { fontSize: 18, color: "#1a1a2e", fontWeight: "900" },
  recentList: { paddingBottom: 40 },
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
  recentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  recentNumber: { fontSize: 23, fontWeight: "900", color: "#1a1a2e" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "900",
    color: "#fff",
  },
  statusPending: { backgroundColor: "#e67e22" },
  statusReady: { backgroundColor: "#3498db" },
  statusCompleted: { backgroundColor: "#27ae60" },
  statusCancelled: { backgroundColor: "#95a5a6" },
  recentItems: { fontSize: 15, color: "#555", fontWeight: "700", marginTop: 3 },
  recentPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  recentPhone: { fontSize: 14, color: "#444", fontWeight: "800" },
  phoneEditBtn: {
    backgroundColor: "#eef2f7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  phoneEditBtnText: { fontSize: 12, color: "#1a1a2e", fontWeight: "900" },
  recentTotal: {
    fontSize: 17,
    fontWeight: "900",
    color: "#e74c3c",
    marginTop: 2,
  },
  cancelBtn: {
    backgroundColor: "#ff4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  // 매출
  salesSection: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 40,
  },
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    maxWidth: 420,
  },
  modalContentWide: {
    maxWidth: 620,
    padding: 26,
    borderRadius: 18,
  },
  modalBodyScroll: { flexShrink: 1 },
  modalBodyContent: { paddingBottom: 4 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 10,
  },
  modalTitleWide: { fontSize: 30, marginBottom: 16, fontWeight: "900" },
  modalSummary: {
    backgroundColor: "#f8f8f8",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  modalItem: { fontSize: 14, color: "#555", marginBottom: 4 },
  modalItemWide: { fontSize: 21, fontWeight: "800", marginBottom: 8 },
  modalTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e74c3c",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 8,
  },
  modalTotalWide: { fontSize: 25, fontWeight: "900", marginTop: 12 },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 3,
  },
  inputLabelWide: { fontSize: 20, fontWeight: "900", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 16,
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 8,
  },
  phoneInput: { flex: 1, marginBottom: 0 },
  waitingPhoneBtn: {
    minWidth: 110,
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#d8e0eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  waitingPhoneBtnWide: {
    minWidth: 174,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  waitingPhoneBtnText: { fontSize: 14, fontWeight: "900", color: "#1a1a2e" },
  waitingPhoneBtnTextWide: { fontSize: 20 },
  waitingPhoneSubText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#555",
    marginTop: 2,
  },
  waitingPhoneSubTextWide: { fontSize: 15 },
  clearPhoneBtn: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#fff3f3",
    borderWidth: 1,
    borderColor: "#ffd3d3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  clearPhoneBtnWide: { minHeight: 58, borderRadius: 12, marginBottom: 16 },
  clearPhoneBtnText: { fontSize: 14, fontWeight: "900", color: "#c92a2a" },
  clearPhoneBtnTextWide: { fontSize: 20 },
  inputWide: {
    fontSize: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },
  cashDetailsSlot: { minHeight: 118 },
  cashShortcuts: { flexDirection: "row", gap: 8, marginBottom: 8 },
  payTabRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  payTab: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f7f7f7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#d8d8d8",
  },
  payTabCash: { backgroundColor: "#fffaf0" },
  payTabCard: { backgroundColor: "#f0f6ff" },
  payTabActive: {
    backgroundColor: "#fff",
    borderColor: "#1a1a2e",
  },
  payTabIcon: { fontSize: 18, marginBottom: 1, color: "#777" },
  payTabText: { fontSize: 17, fontWeight: "800", color: "#555" },
  payTabIconWide: { fontSize: 28, marginBottom: 4 },
  payTabTextWide: { fontSize: 25, fontWeight: "900" },
  payTabTextActive: { color: "#1a1a2e" },
  cashBtn: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  cashBtnText: { fontSize: 13, fontWeight: "600", color: "#555" },
  cashBtnTextWide: { fontSize: 19, fontWeight: "900" },
  changeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2ecc71",
    marginBottom: 12,
  },
  changeTextWide: { fontSize: 22, fontWeight: "900" },
  changeTextPlaceholder: {
    fontSize: 16,
    marginBottom: 12,
  },
  changeNegative: { color: "#e74c3c" },
  nextNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a1a2e",
    textAlign: "center",
    marginVertical: 8,
  },
  nextNumberWide: { fontSize: 34, marginVertical: 14 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 16, fontWeight: "700", color: "#555" },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  modalCompleteBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#27ae60",
    alignItems: "center",
  },
  modalSubmitText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  modalButtonTextWide: { fontSize: 22, fontWeight: "900" },
  phoneEditModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
  },
  phoneEditModalWide: { maxWidth: 620, padding: 26, borderRadius: 18 },
});
