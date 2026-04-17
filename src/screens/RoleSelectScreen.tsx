import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "RoleSelect">;

const roles = [
  {
    key: "Counter" as const,
    label: "카운터",
    emoji: "🧾",
    description: "주문 접수 · 결제 · 매출 확인",
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
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Festival Order</Text>
        <Text style={styles.subtitle}>역할을 선택하세요</Text>

        <View style={styles.grid}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.key}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(role.key)}
            >
              <Text style={styles.emoji}>{role.emoji}</Text>
              <Text style={styles.cardLabel}>{role.label}</Text>
              <Text style={styles.cardDesc}>{role.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.bottomBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("MenuManage")}
          >
            <Text style={styles.bottomBtnText}>⚙️ 메뉴 관리</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("SalesDashboard")}
          >
            <Text style={styles.bottomBtnText}>📊 매출 조회</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
  },
  grid: {
    width: "100%",
    maxWidth: 600,
    gap: 16,
  },
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
  emoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: "#888",
  },
  bottomRow: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 600,
    gap: 12,
    marginTop: 20,
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#e8e8e8",
    alignItems: "center",
  },
  bottomBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
  },
});
