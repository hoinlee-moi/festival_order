import React, { useCallback, useState } from "react";
import {
  BackHandler,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "RoleSelect">;

const roles = [
  {
    key: "Counter" as const,
    label: "카운터",
    emoji: "🧾",
    description: "주문 접수 · 결제 · 최근 주문",
  },
  {
    key: "Kitchen" as const,
    label: "주방",
    emoji: "🍳",
    description: "조리 현황 · 요리 완료 처리",
  },
  {
    key: "Pickup" as const,
    label: "배출구",
    emoji: "📦",
    description: "SMS 호출 · 최종 수령 처리",
  },
];

export default function RoleSelectScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [showSalesPassword, setShowSalesPassword] = useState(false);
  const [salesPassword, setSalesPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (showSalesPassword) {
            setShowSalesPassword(false);
            return true;
          }

          BackHandler.exitApp();
          return true;
        },
      );

      return () => subscription.remove();
    }, [showSalesPassword]),
  );

  const openSalesDashboard = () => {
    setSalesPassword("");
    setShowSalesPassword(true);
  };

  const submitSalesPassword = () => {
    if (salesPassword !== "2580") {
      Alert.alert("오류", "비밀번호가 올바르지 않습니다.");
      return;
    }
    setShowSalesPassword(false);
    navigation.navigate("SalesDashboard");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && styles.scrollContentWide,
        ]}
      >
        <Text style={[styles.title, isWide && styles.titleWide]}>
          브뤼셀 축제앱
        </Text>
        <Text style={[styles.subtitle, isWide && styles.subtitleWide]}>
          역할을 선택하세요
        </Text>

        <View style={[styles.grid, isWide && styles.gridWide]}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.key}
              style={[styles.card, isWide && styles.cardWide]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(role.key)}
            >
              <Text style={[styles.emoji, isWide && styles.emojiWide]}>
                {role.emoji}
              </Text>
              <Text style={[styles.cardLabel, isWide && styles.cardLabelWide]}>
                {role.label}
              </Text>
              <Text style={[styles.cardDesc, isWide && styles.cardDescWide]}>
                {role.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.bottomRow, isWide && styles.bottomRowWide]}>
          <TouchableOpacity
            style={[styles.bottomBtn, isWide && styles.bottomBtnWide]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("MenuManage")}
          >
            <Text
              style={[styles.bottomBtnText, isWide && styles.bottomBtnTextWide]}
            >
              ⚙️ 메뉴 관리
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomBtn, isWide && styles.bottomBtnWide]}
            activeOpacity={0.7}
            onPress={openSalesDashboard}
          >
            <Text
              style={[styles.bottomBtnText, isWide && styles.bottomBtnTextWide]}
            >
              📊 매출 조회
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showSalesPassword} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.passwordModal, isWide && styles.passwordModalWide]}
          >
            <Text
              style={[styles.passwordTitle, isWide && styles.passwordTitleWide]}
            >
              매출 조회 비밀번호
            </Text>
            <TextInput
              style={[styles.passwordInput, isWide && styles.passwordInputWide]}
              value={salesPassword}
              onChangeText={setSalesPassword}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="비밀번호 입력"
            />
            <View style={styles.passwordActions}>
              <TouchableOpacity
                style={styles.passwordCancelBtn}
                onPress={() => setShowSalesPassword(false)}
              >
                <Text
                  style={[
                    styles.passwordCancelText,
                    isWide && styles.passwordActionTextWide,
                  ]}
                >
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.passwordSubmitBtn}
                onPress={submitSalesPassword}
              >
                <Text
                  style={[
                    styles.passwordSubmitText,
                    isWide && styles.passwordActionTextWide,
                  ]}
                >
                  확인
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  scrollContentWide: {
    paddingHorizontal: 56,
    paddingTop: 48,
    paddingBottom: 56,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  titleWide: { fontSize: 52, marginBottom: 8, fontWeight: "900" },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
  },
  subtitleWide: { fontSize: 24, marginBottom: 54, fontWeight: "800" },
  grid: {
    width: "100%",
    maxWidth: 600,
    gap: 16,
  },
  gridWide: { maxWidth: 980, gap: 22 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardWide: {
    minHeight: 150,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 28,
  },
  emoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  emojiWide: { fontSize: 58, marginBottom: 8 },
  cardLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 2,
  },
  cardLabelWide: { fontSize: 30, fontWeight: "900", marginBottom: 6 },
  cardDesc: {
    fontSize: 13,
    color: "#888",
  },
  cardDescWide: { fontSize: 20, fontWeight: "700" },
  bottomRow: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 600,
    gap: 12,
    marginTop: 20,
  },
  bottomRowWide: { maxWidth: 980, gap: 18, marginTop: 26 },
  bottomBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#e8e8e8",
    alignItems: "center",
  },
  bottomBtnWide: { paddingVertical: 22, borderRadius: 14 },
  bottomBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
  },
  bottomBtnTextWide: { fontSize: 22, fontWeight: "900" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  passwordModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
  },
  passwordModalWide: { maxWidth: 520, borderRadius: 18, padding: 28 },
  passwordTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 12,
    textAlign: "center",
  },
  passwordTitleWide: { fontSize: 27, marginBottom: 18 },
  passwordInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    textAlign: "center",
    marginBottom: 14,
  },
  passwordInputWide: { fontSize: 28, paddingVertical: 16, marginBottom: 20 },
  passwordActions: { flexDirection: "row", gap: 10 },
  passwordCancelBtn: {
    flex: 1,
    backgroundColor: "#e0e0e0",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  passwordCancelText: { fontSize: 15, fontWeight: "700", color: "#555" },
  passwordSubmitBtn: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  passwordSubmitText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  passwordActionTextWide: { fontSize: 22, fontWeight: "900" },
});
