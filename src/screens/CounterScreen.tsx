import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";

export default function CounterScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🧾 카운터</Text>
        <Text style={styles.placeholder}>주문 접수 화면 (구현 예정)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  placeholder: {
    fontSize: 16,
    color: "#999",
  },
});
