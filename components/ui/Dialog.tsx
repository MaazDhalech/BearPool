import { ACCENT } from "@/constants/Colors";
import { SPACE } from "@/constants/Spacing";
import { darkTheme as t } from "@/constants/theme";
import { TYPE } from "@/constants/Typography";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * App-wide imperative dialogs + toasts, replacing native Alert.alert.
 *
 *   await confirm({ title, message, confirmText, destructive })  // -> boolean
 *   showMenu({ title, options: [{ label, destructive, onPress }] })
 *   toast("Saved", { type: "success" })
 *
 * Mount <DialogHost /> once near the app root.
 */

type ConfirmOpts = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};
type MenuOption = { label: string; destructive?: boolean; onPress?: () => void };
type MenuOpts = { title?: string; message?: string; options: MenuOption[]; onCancel?: () => void };
type PromptOpts = {
  title?: string;
  message?: string;
  placeholder?: string;
  secure?: boolean;
  confirmText?: string;
};
type ToastType = "info" | "success" | "error";
type ToastItem = { id: number; message: string; type: ToastType };

type State = {
  confirm: (ConfirmOpts & { resolve: (v: boolean) => void }) | null;
  menu: MenuOpts | null;
  prompt: (PromptOpts & { resolve: (v: string | null) => void }) | null;
  toasts: ToastItem[];
};

let state: State = { confirm: null, menu: null, prompt: null, toasts: [] };
const listeners = new Set<() => void>();
const emit = () => {
  state = { ...state };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getState = () => state;

export function confirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    state.confirm = { ...opts, resolve };
    emit();
  });
}

export function showMenu(opts: MenuOpts) {
  state.menu = opts;
  emit();
}

export function prompt(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    state.prompt = { ...opts, resolve };
    emit();
  });
}

let toastId = 0;
export function toast(message: string, opts?: { type?: ToastType; duration?: number }) {
  const id = ++toastId;
  state.toasts = [...state.toasts, { id, message, type: opts?.type ?? "info" }];
  emit();
  setTimeout(() => {
    state.toasts = state.toasts.filter((x) => x.id !== id);
    emit();
  }, opts?.duration ?? 2800);
}

const TOAST_COLORS: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  info: { icon: "information-circle", color: ACCENT },
  success: { icon: "checkmark-circle", color: t.success },
  error: { icon: "alert-circle", color: t.danger },
};

export function DialogHost() {
  const s = useSyncExternalStore(subscribe, getState, getState);
  const insets = useSafeAreaInsets();
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    if (s.prompt) setPromptValue("");
  }, [s.prompt]);

  const closeConfirm = (result: boolean) => {
    const c = s.confirm;
    state.confirm = null;
    emit();
    c?.resolve(result);
  };
  const closeMenu = () => {
    state.menu = null;
    emit();
  };
  const dismissMenu = () => {
    const m = s.menu;
    state.menu = null;
    emit();
    m?.onCancel?.();
  };
  const closePrompt = (value: string | null) => {
    const p = s.prompt;
    state.prompt = null;
    emit();
    p?.resolve(value);
  };

  return (
    <>
      {/* Toasts */}
      {s.toasts.length > 0 && (
        <View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + 8 }]}>
          {s.toasts.map((item) => {
            const c = TOAST_COLORS[item.type];
            return (
              <View key={item.id} style={styles.toast}>
                <Ionicons name={c.icon} size={18} color={c.color} />
                <Text style={styles.toastText} numberOfLines={4}>
                  {item.message}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Confirm dialog */}
      <Modal
        visible={!!s.confirm}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => closeConfirm(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {s.confirm?.title ? <Text style={styles.title}>{s.confirm.title}</Text> : null}
            {s.confirm?.message ? <Text style={styles.message}>{s.confirm.message}</Text> : null}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, styles.btnNeutral]}
                activeOpacity={0.7}
                onPress={() => closeConfirm(false)}
              >
                <Text style={styles.btnNeutralText}>{s.confirm?.cancelText ?? "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, s.confirm?.destructive ? styles.btnDanger : styles.btnPrimary]}
                activeOpacity={0.7}
                onPress={() => closeConfirm(true)}
              >
                <Text style={s.confirm?.destructive ? styles.btnDangerText : styles.btnPrimaryText}>
                  {s.confirm?.confirmText ?? "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action menu (bottom sheet) */}
      <Modal
        visible={!!s.menu}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={dismissMenu}
      >
        <TouchableWithoutFeedback onPress={dismissMenu}>
          <View style={styles.menuBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.menuSheet, { paddingBottom: Math.max(insets.bottom, SPACE.md) + SPACE.sm }]}>
                <View style={styles.grabber} />
                {s.menu?.title ? <Text style={styles.menuTitle}>{s.menu.title}</Text> : null}
                {s.menu?.message ? <Text style={styles.menuMessage}>{s.menu.message}</Text> : null}
                {s.menu?.options.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.7}
                    style={styles.menuItem}
                    onPress={() => {
                      closeMenu();
                      opt.onPress?.();
                    }}
                  >
                    <Text style={[styles.menuItemText, opt.destructive && { color: t.danger }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={dismissMenu}>
                  <Text style={[styles.menuItemText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Prompt (text input) */}
      <Modal
        visible={!!s.prompt}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => closePrompt(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {s.prompt?.title ? <Text style={styles.title}>{s.prompt.title}</Text> : null}
            {s.prompt?.message ? <Text style={styles.message}>{s.prompt.message}</Text> : null}
            <TextInput
              style={styles.input}
              value={promptValue}
              onChangeText={setPromptValue}
              placeholder={s.prompt?.placeholder}
              placeholderTextColor={t.textMuted}
              secureTextEntry={s.prompt?.secure}
              autoFocus
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, styles.btnNeutral]}
                activeOpacity={0.7}
                onPress={() => closePrompt(null)}
              >
                <Text style={styles.btnNeutralText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                activeOpacity={0.7}
                onPress={() => closePrompt(promptValue)}
              >
                <Text style={styles.btnPrimaryText}>{s.prompt?.confirmText ?? "OK"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: "absolute", left: SPACE.md, right: SPACE.md, gap: SPACE.sm, zIndex: 1000 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: "#262628",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.raised,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
  },
  toastText: { flex: 1, color: t.textBright, fontSize: TYPE.size.body, fontWeight: "500" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE["2xl"],
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: t.surface,
    borderRadius: 18,
    padding: SPACE.xl,
  },
  title: { color: t.textPrimary, fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.bold, marginBottom: SPACE.sm },
  message: { color: t.textSecondary, fontSize: TYPE.size.body, lineHeight: TYPE.size.body * 1.45, marginBottom: SPACE.lg },
  input: {
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 10,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    color: t.textPrimary,
    fontSize: TYPE.size.body,
    marginBottom: SPACE.lg,
  },
  row: { flexDirection: "row", gap: SPACE.sm },
  btn: { flex: 1, borderRadius: 10, paddingVertical: SPACE.sm + 2, alignItems: "center", justifyContent: "center" },
  btnNeutral: { backgroundColor: t.raised },
  btnNeutralText: { color: t.textPrimary, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold },
  btnPrimary: { backgroundColor: ACCENT },
  btnPrimaryText: { color: t.onAccent, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold },
  btnDanger: { backgroundColor: "#3a1f1f" },
  btnDangerText: { color: t.danger, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold },

  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  menuSheet: { backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: SPACE.sm },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#3a3a3a", marginBottom: SPACE.sm },
  menuTitle: { color: t.textPrimary, fontSize: TYPE.size.body, fontWeight: TYPE.weight.bold, textAlign: "center", paddingHorizontal: SPACE.lg },
  menuMessage: { color: t.textSecondary, fontSize: TYPE.size.label, textAlign: "center", paddingHorizontal: SPACE.lg, marginTop: 4 },
  menuItem: { paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, alignItems: "center" },
  menuItemText: { color: t.textPrimary, fontSize: TYPE.size.body, fontWeight: "500" },
});
