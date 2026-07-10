import { darkTheme } from "@/constants/theme";
import { TYPE } from "@/constants/Typography";
import { Text, TouchableOpacity, View } from "react-native";

export type Reaction = { emoji: string; userIds: string[] };

type Props = {
  reactions?: Reaction[] | null;
  currentUserId?: string;
  onToggle: (emoji: string) => void;
  alignRight: boolean;
};

/**
 * Reaction pills rendered below a message bubble. A pill the current user has
 * reacted with is highlighted in accent blue; others are dark gray.
 */
export function MessageReactions({ reactions, currentUserId, onToggle, alignRight }: Props) {
  const active = (reactions ?? []).filter((r) => r.userIds.length > 0);
  if (active.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 4,
        maxWidth: "100%",
        justifyContent: alignRight ? "flex-end" : "flex-start",
      }}
    >
      {active.map((r) => {
        const mine = !!currentUserId && r.userIds.includes(currentUserId);
        return (
          <TouchableOpacity
            key={r.emoji}
            onPress={() => onToggle(r.emoji)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              backgroundColor: mine ? "rgba(10,132,255,0.18)" : darkTheme.raised,
              borderWidth: 1,
              borderColor: mine ? "#0a84ff" : "transparent",
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
            <Text
              style={{
                fontSize: TYPE.size.micro,
                color: mine ? "#cfe4ff" : darkTheme.textSecondary,
                fontWeight: "600",
              }}
            >
              {r.userIds.length}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
