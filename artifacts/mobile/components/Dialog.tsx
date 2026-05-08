import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export type PromptOptions = {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

export type ChoiceOption<T> = {
  label: string;
  value: T;
  destructive?: boolean;
};

export type ChoiceOptions<T> = {
  title: string;
  message?: string;
  options: ChoiceOption<T>[];
  cancelText?: string;
};

export type DialogContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  choice: <T>(opts: ChoiceOptions<T>) => Promise<T | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type Resolver<T> = (value: T) => void;

type ConfirmState = {
  kind: "confirm";
  opts: ConfirmOptions;
  resolve: Resolver<boolean>;
};
type PromptState = {
  kind: "prompt";
  opts: PromptOptions;
  value: string;
  resolve: Resolver<string | null>;
};
type ChoiceState = {
  kind: "choice";
  opts: ChoiceOptions<unknown>;
  resolve: Resolver<unknown>;
};
type State =
  | { kind: "idle" }
  | ConfirmState
  | PromptState
  | ChoiceState;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const [state, setState] = useState<State>({ kind: "idle" });
  // Track the resolver separately so we never double-resolve under StrictMode.
  const settledRef = useRef(false);

  const settle = useCallback((next: () => void) => {
    if (settledRef.current) return;
    settledRef.current = true;
    next();
    setState({ kind: "idle" });
  }, []);

  const open = useCallback((next: ConfirmState | PromptState | ChoiceState) => {
    settledRef.current = false;
    setState(next);
  }, []);

  const ctx: DialogContextValue = {
    confirm: (opts) =>
      new Promise<boolean>((resolve) => {
        open({ kind: "confirm", opts, resolve });
      }),
    prompt: (opts) =>
      new Promise<string | null>((resolve) => {
        open({
          kind: "prompt",
          opts,
          value: opts.defaultValue ?? "",
          resolve,
        });
      }),
    choice: <T,>(opts: ChoiceOptions<T>) =>
      new Promise<T | null>((resolve) => {
        open({
          kind: "choice",
          opts: opts as ChoiceOptions<unknown>,
          resolve: resolve as Resolver<unknown>,
        });
      }),
  };

  const visible = state.kind !== "idle";

  function dismiss() {
    if (state.kind === "confirm") settle(() => state.resolve(false));
    else if (state.kind === "prompt") settle(() => state.resolve(null));
    else if (state.kind === "choice") settle(() => state.resolve(null));
  }

  return (
    <DialogContext.Provider value={ctx}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={dismiss}
      >
        <Pressable style={styles.backdrop} onPress={dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.center}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={() => {
                /* eat clicks inside the card */
              }}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {state.kind !== "idle" ? (
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {state.opts.title}
                </Text>
              ) : null}

              {state.kind === "confirm" && state.opts.message ? (
                <Text style={[styles.message, { color: colors.mutedForeground }]}>
                  {state.opts.message}
                </Text>
              ) : null}

              {state.kind === "prompt" ? (
                <PromptBody
                  state={state}
                  colors={colors}
                  onChange={(t) =>
                    setState((s) => (s.kind === "prompt" ? { ...s, value: t } : s))
                  }
                  onSubmit={() =>
                    settle(() => state.resolve(state.value))
                  }
                />
              ) : null}

              {state.kind === "choice" ? (
                <View style={{ gap: 8, marginTop: 12 }}>
                  {state.opts.message ? (
                    <Text
                      style={[
                        styles.message,
                        { color: colors.mutedForeground, marginTop: 0 },
                      ]}
                    >
                      {state.opts.message}
                    </Text>
                  ) : null}
                  <ScrollView
                    style={{ maxHeight: 320 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {state.opts.options.map((opt, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.choiceBtn,
                          {
                            backgroundColor: opt.destructive
                              ? "#FEE2E2"
                              : colors.muted,
                            borderColor: opt.destructive ? "#FCA5A5" : colors.border,
                          },
                        ]}
                        onPress={() =>
                          settle(() => state.resolve(opt.value))
                        }
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            {
                              color: opt.destructive
                                ? "#B91C1C"
                                : colors.foreground,
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {state.kind === "confirm" ? (
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                    onPress={() => settle(() => state.resolve(false))}
                  >
                    <Text style={[styles.btnText, { color: colors.foreground }]}>
                      {state.opts.cancelText ?? "Cancel"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      {
                        backgroundColor: state.opts.destructive
                          ? "#DC2626"
                          : colors.primary,
                        borderColor: "transparent",
                      },
                    ]}
                    onPress={() => settle(() => state.resolve(true))}
                  >
                    <Text style={[styles.btnText, { color: "#fff" }]}>
                      {state.opts.confirmText ??
                        (state.opts.destructive ? "Delete" : "OK")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {state.kind === "prompt" ? (
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                    onPress={() => settle(() => state.resolve(null))}
                  >
                    <Text style={[styles.btnText, { color: colors.foreground }]}>
                      {state.opts.cancelText ?? "Cancel"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      {
                        backgroundColor: colors.primary,
                        borderColor: "transparent",
                      },
                    ]}
                    onPress={() => settle(() => state.resolve(state.value))}
                  >
                    <Text style={[styles.btnText, { color: "#fff" }]}>
                      {state.opts.confirmText ?? "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {state.kind === "choice" ? (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                        flex: 1,
                      },
                    ]}
                    onPress={() => settle(() => state.resolve(null))}
                  >
                    <Text style={[styles.btnText, { color: colors.foreground }]}>
                      {state.opts.cancelText ?? "Cancel"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

function PromptBody({
  state,
  colors,
  onChange,
  onSubmit,
}: {
  state: PromptState;
  colors: ReturnType<typeof useColors>;
  onChange: (t: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<TextInput | null>(null);
  React.useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      {state.opts.message ? (
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          {state.opts.message}
        </Text>
      ) : null}
      <TextInput
        ref={inputRef}
        value={state.value}
        onChangeText={onChange}
        placeholder={state.opts.placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={state.opts.multiline}
        autoCapitalize={state.opts.autoCapitalize}
        onSubmitEditing={state.opts.multiline ? undefined : onSubmit}
        returnKeyType={state.opts.multiline ? "default" : "done"}
        style={[
          styles.input,
          {
            backgroundColor: colors.muted,
            color: colors.foreground,
            borderColor: colors.border,
            height: state.opts.multiline ? 100 : 44,
            textAlignVertical: state.opts.multiline ? "top" : "center",
          },
        ]}
      />
    </>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used inside DialogProvider");
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    justifyContent: "flex-end",
  },
  btn: {
    minWidth: 96,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  choiceBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  choiceText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
