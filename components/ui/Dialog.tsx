import { ACCENT } from "@/constants/Colors";
import { SPACE } from "@/constants/Spacing";
import { darkTheme as t } from "@/constants/theme";
import { TYPE } from "@/constants/Typography";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Keyboard,
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
 * App-wide imperative dialogs + toasts. Confirm/prompt use a custom Modal;
 * multi-option pickers go through the native Alert.alert instead (see
 * ContextMenu.tsx / viewProfile.tsx / group-settings.tsx for examples).
 *
 *   await confirm({ title, message, confirmText, destructive })  // -> boolean
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
  prompt: (PromptOpts & { resolve: (v: string | null) => void }) | null;
  toasts: ToastItem[];
};

// RN's Modal presents/dismisses via a real native transition (not just a JS
// state flip) that takes real wall-clock time — roughly this long on both
// platforms. Presenting a new Modal before the previous one has actually
// finished dismissing natively hangs the app, so any code that closes one
// dialog and opens another must wait at least this long first.
export const MODAL_DISMISS_MS = 350;

let state: State = { confirm: null, prompt: null, toasts: [] };
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

      {/* Prompt (text input) */}
      <Modal
        visible={!!s.prompt}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => closePrompt(null)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
        </TouchableWithoutFeedback>
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
});
