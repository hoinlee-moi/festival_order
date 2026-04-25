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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList, Menu } from "../types";
import { useAllMenus, useRefreshMenus } from "../hooks/useMenus";
import { supabase } from "../lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "MenuManage">;

type ModalMode = "create" | "edit";

export default function MenuManageScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data: menus = [], isLoading } = useAllMenus();
  const refreshMenus = useRefreshMenus();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editAvailable, setEditAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setModalMode("create");
    setEditingMenu(null);
    setEditName("");
    setEditPrice("");
    setEditAvailable(true);
    setModalVisible(true);
  };

  const openEdit = (menu: Menu) => {
    setModalMode("edit");
    setEditingMenu(menu);
    setEditName(menu.name);
    setEditPrice(String(menu.price));
    setEditAvailable(menu.is_available);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingMenu(null);
  };

  const handleSave = async () => {
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
      if (modalMode === "create") {
        const maxSort = menus.reduce(
          (m, item) => Math.max(m, item.sort_order ?? 0),
          0,
        );
        const { error } = await supabase.from("menus").insert({
          name: trimmedName,
          price,
          is_available: editAvailable,
          sort_order: maxSort + 1,
        });
        if (error) throw error;
        closeModal();
        refreshMenus();
        Alert.alert("완료", "메뉴가 추가되었습니다.");
      } else if (modalMode === "edit" && editingMenu) {
        const { error } = await supabase
          .from("menus")
          .update({
            name: trimmedName,
            price,
            is_available: editAvailable,
          })
          .eq("id", editingMenu.id);
        if (error) throw error;
        closeModal();
        refreshMenus();
        Alert.alert("완료", "메뉴가 수정되었습니다.");
      }
    } catch {
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingMenu) return;
    Alert.alert(
      "메뉴 삭제",
      `"${editingMenu.name}" 메뉴를 삭제하시겠습니까?\n삭제된 메뉴는 복구할 수 없습니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const { error } = await supabase
                .from("menus")
                .delete()
                .eq("id", editingMenu.id);
              if (error) throw error;
              closeModal();
              refreshMenus();
              Alert.alert("완료", "메뉴가 삭제되었습니다.");
            } catch {
              Alert.alert("오류", "삭제에 실패했습니다.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
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
          {item.is_available ? "판매중" : "판매 중지"}
        </Text>
        <Text style={styles.editHint}>터치하여 수정</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
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

      {/* 추가 FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 24) }]}
        activeOpacity={0.8}
        onPress={openCreate}
      >
        <Text style={styles.fabText}>＋ 새 메뉴</Text>
      </TouchableOpacity>

      {/* 추가/수정 모달 */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalMode === "create" ? "새 메뉴 추가" : "메뉴 수정"}
            </Text>

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
              <Text style={styles.inputLabel}>판매 상태</Text>
              <Switch value={editAvailable} onValueChange={setEditAvailable} />
            </View>
            <Text
              style={editAvailable ? styles.availableNote : styles.pausedNote}
            >
              {editAvailable
                ? "카운터 주문 화면에 표시됩니다."
                : "판매 중지 상태입니다. DB에는 남아 있고 주문 화면에서만 숨겨집니다."}
            </Text>

            {modalMode === "edit" && (
              <TouchableOpacity
                style={[styles.deleteBtn, saving && styles.btnDisabled]}
                onPress={handleDelete}
                disabled={saving}
              >
                <Text style={styles.deleteBtnText}>🗑 메뉴 삭제</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving
                    ? "저장 중..."
                    : modalMode === "create"
                      ? "추가"
                      : "저장"}
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
  list: { padding: 12, paddingBottom: 120 },
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 16, fontWeight: "700" },
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
    marginBottom: 8,
  },
  availableNote: {
    fontSize: 13,
    color: "#2ecc71",
    fontWeight: "600",
    marginBottom: 20,
  },
  pausedNote: {
    fontSize: 13,
    color: "#e67e22",
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 20,
  },
  deleteBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fff0f0",
    borderWidth: 1,
    borderColor: "#e74c3c",
    alignItems: "center",
    marginBottom: 14,
  },
  deleteBtnText: { fontSize: 15, fontWeight: "700", color: "#e74c3c" },
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
