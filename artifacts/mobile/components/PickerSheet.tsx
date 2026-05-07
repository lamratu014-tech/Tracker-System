import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export type PickerItem = {
  id: string;
  label: string;
  sublabel?: string;
};

export type PickerSection = {
  header?: string;
  items: PickerItem[];
};

type Row =
  | { kind: "header"; key: string; label: string }
  | { kind: "item"; key: string; item: PickerItem };

function flatten(sections: PickerSection[], query: string): Row[] {
  const q = query.trim().toLowerCase();
  const rows: Row[] = [];
  for (const section of sections) {
    const filtered = q
      ? section.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            (it.sublabel ? it.sublabel.toLowerCase().includes(q) : false) ||
            (section.header ? section.header.toLowerCase().includes(q) : false),
        )
      : section.items;
    if (filtered.length === 0) continue;
    if (section.header) {
      rows.push({ kind: "header", key: `h:${section.header}`, label: section.header });
    }
    for (const it of filtered) {
      rows.push({ kind: "item", key: `i:${it.id}`, item: it });
    }
  }
  return rows;
}

export function PickerSheet(props: {
  visible: boolean;
  onClose: () => void;
  title: string;
  sections: PickerSection[];
  selectedId?: string;
  onSelect: (id: string) => void;
  searchPlaceholder?: string;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => flatten(props.sections, query), [props.sections, query]);

  function handleClose() {
    setQuery("");
    props.onClose();
  }

  function handleSelect(id: string) {
    props.onSelect(id);
    setQuery("");
    props.onClose();
  }

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{props.title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={props.searchPlaceholder ?? "Search…"}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.searchInput, { color: colors.foreground }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ color: colors.mutedForeground }}>No matches.</Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(r) => r.key}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: row }) => {
                if (row.kind === "header") {
                  return (
                    <View style={[styles.sectionHeader, { backgroundColor: colors.muted }]}>
                      <Text
                        style={[styles.sectionHeaderText, { color: colors.mutedForeground }]}
                      >
                        {row.label.toUpperCase()}
                      </Text>
                    </View>
                  );
                }
                const active = row.item.id === props.selectedId;
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderBottomColor: colors.border }]}
                    onPress={() => handleSelect(row.item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                        {row.item.label}
                      </Text>
                      {row.item.sublabel ? (
                        <Text
                          style={[styles.rowSublabel, { color: colors.mutedForeground }]}
                        >
                          {row.item.sublabel}
                        </Text>
                      ) : null}
                    </View>
                    {active ? (
                      <Feather name="check" size={18} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    maxHeight: "85%",
    minHeight: "55%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  searchWrap: { padding: 12 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 6 },
  sectionHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rowLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowSublabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { padding: 24, alignItems: "center" },
});
