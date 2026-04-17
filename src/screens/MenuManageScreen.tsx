import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList, Menu } from "../types";
import { useMenus, useRefreshMenus } from "../hooks/useMenus";
import { supabase } from "../lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "MenuManage">;

export default function MenuManageScreen({ navigation }: Props) {
  const { data: menus = [], isLoading } = useMenus();
  const refreshMenus = useRefreshMenus();

  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editAvailable, setEditAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  const openEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setEditName(menu.name);
    setEditPrice(String(menu.price));
    setEditAvailable(menu.is_available);
  };

  const handleSave = async () => {
    if (!editingMenu) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert("오류", "메뉴 이름을 입력하세요.");
      return;
    }
    const price = parseInt(editPrice, 10);
    if (isNaN(price) || price <= 0) {
      Alert.alert("오류", "올바른 가격을 입력하세요.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("menus")
        .update({
          name: trimmedName,
          price,
          is_available: editAvailable,
        })
        .eq("id", editingMenu.id);

      if (error) throw error;

      setEditingMenu(null);
      refreshMenus();
      Alert.alert("완료", "메뉴가 수정되었습니다.");
    } catch {
      Alert.alert("오류", "메뉴 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const renderMenuItem = ({ item }: { item: Menu }) => (
    <TouchableOpacity
      style={[styles.menuCard, !item.is_available && styles.menuCardDisabled]}
      activeOpacity={0.7}
      onPress={() => openEdit(item)}
    >
      <View style={styles.menuInfo}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.menuPrice}>{item.price.toLocaleString()}원</Text>
      </View>
      <View style={styles.menuStatus}>
        <Text style={item.is_available ? styles.statusOn : styles.statusOff}>
          {item.is_available ? "판매중" : "품절"}
        </Text>
        <Text style={styles.editHint}>터치하여 수정</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← 돌아가기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ 메뉴 관리</Text>
        <TouchableOpacity onPress={refreshMenus}>
          <Text style={styles.refreshBtn}>🔄</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={menus}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderMenuItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>등록된 메뉴가 없습니다</Text>
          }
        />
      )}

      {/* 수정 모달 */}
      <Modal visible={!!editingMenu} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>메뉴 수정</Text>

            <Text style={styles.inputLabel}>메뉴 이름</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="메뉴 이름"
            />

            <Text style={styles.inputLabel}>가격 (원)</Text>
            <TextInput
              style={styles.input}
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="number-pad"
              placeholder="가격"
            />

            <View style={styles.switchRow}>
              <Text style={styles.inputLabel}>판매 가능</Text>
              <Switch value={editAvailable} onValueChange={setEditAvailable} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingMenu(null)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? "저장 중..." : "저장"}
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
  backBtn: { fontSize: 14, color: "#aaa", fontWeight: "600" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  refreshBtn: { fontSize: 20 },
  // 리스트
  list: { padding: 12 },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 16,
    marginTop: 40,
  },
  menuCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuCardDisabled: { opacity: 0.5 },
  menuInfo: { flex: 1 },
  menuName: { fontSize: 18, fontWeight: "700", color: "#333", marginBottom: 4 },
  menuPrice: { fontSize: 16, fontWeight: "600", color: "#e74c3c" },
  menuStatus: { alignItems: "flex-end" },
  statusOn: { fontSize: 13, fontWeight: "700", color: "#2ecc71" },
  statusOff: { fontSize: 13, fontWeight: "700", color: "#e74c3c" },
  editHint: { fontSize: 11, color: "#bbb", marginTop: 4 },
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
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 16, fontWeight: "700", color: "#555" },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
});
