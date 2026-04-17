import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
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
      <Text style={styles.title}>Festival Order</Text>
      <Text style={styles.subtitle}>역할을 선택하세요</Text>

      <View style={styles.grid}>
        {roles.map((role) => (
          <TouchableOpacity
            key={role.key}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => navigation.replace(role.key)}
          >
            <Text style={styles.emoji}>{role.emoji}</Text>
            <Text style={styles.cardLabel}>{role.label}</Text>
            <Text style={styles.cardDesc}>{role.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: "#888",
  },
});
