import { darkTheme } from "@/constants/theme";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { NavHeader } from "@/components/ui/NavHeader";
import { confirm, toast } from "@/components/ui/Dialog";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  ButtonText,
  HStack,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import {
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

interface BlockedUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string;
}

export default function BlockedUsersScreen() {
  const { userId } = useFirebaseAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlockedUsers = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, "users", userId));
      const blockedUserIds: string[] = userSnap.exists()
        ? userSnap.data().blockedUsers || []
        : [];

      if (blockedUserIds.length === 0) {
        setBlockedUsers([]);
        return;
      }

      // Fetch blocked users data in batches (Firestore 'in' query limit is 10)
      const blockedUsersData: BlockedUser[] = [];
      const batchSize = 10;

      for (let i = 0; i < blockedUserIds.length; i += batchSize) {
        const batch = blockedUserIds.slice(i, i + batchSize);
        const q = query(
          collection(db, "users"),
          where("__name__", "in", batch)
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          blockedUsersData.push({
            id: docSnap.id,
            username: data.username || "Unknown",
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            avatar: data.avatar || DEFAULT_AVATAR,
          });
        });
      }

      setBlockedUsers(blockedUsersData);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      toast("Failed to load blocked users.", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [userId]);

  const handleUnblockUser = async (blockedUserId: string, username: string) => {
    if (!userId) return;

    const ok = await confirm({
      title: "Unblock User",
      message: `Are you sure you want to unblock ${username}?`,
      confirmText: "Unblock",
      destructive: true,
    });
    if (!ok) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        blockedUsers: arrayRemove(blockedUserId),
      });

      setBlockedUsers((prev) => prev.filter((user) => user.id !== blockedUserId));

      toast(`${username} has been unblocked.`, { type: "success" });
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast("Failed to unblock user. Please try again.", { type: "error" });
    }
  };

  return (
    <Box flex={1} bg={darkTheme.bg}>
      <NavHeader title="Blocked Users" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Box px="$4" py="$6">
          {loading ? (
            <Box py="$8" alignItems="center">
              <ActivityIndicator size="large" color={darkTheme.danger} />
              <Text color={darkTheme.textSecondary} mt="$4">
                Loading blocked users...
              </Text>
            </Box>
          ) : blockedUsers.length === 0 ? (
            <Box py="$8" alignItems="center">
              <Text color={darkTheme.textSecondary}>No blocked users</Text>
            </Box>
          ) : (
            <VStack space="md">
              {blockedUsers.map((blockedUser) => (
                <HStack
                  key={blockedUser.id}
                  space="md"
                  alignItems="center"
                  bg={darkTheme.raised}
                  p="$3"
                  borderRadius="$md"
                >
                  <Avatar size="md" bg={darkTheme.border}>
                    {blockedUser.avatar ? (
                      <AvatarImage source={{ uri: blockedUser.avatar }} alt="Avatar" />
                    ) : (
                      <Avatar.FallbackText color={darkTheme.textPrimary}>
                        {(blockedUser.first_name?.[0] || "") +
                          (blockedUser.last_name?.[0] || "") || "U"}
                      </Avatar.FallbackText>
                    )}
                  </Avatar>

                  <VStack flex={1}>
                    <Text color={darkTheme.textPrimary} fontWeight="$semibold">
                      {blockedUser.username}
                    </Text>
                    <Text color={darkTheme.textSecondary} fontSize="$sm">
                      {blockedUser.first_name} {blockedUser.last_name}
                    </Text>
                  </VStack>

                  <Button
                    size="sm"
                    bg={darkTheme.danger}
                    onPress={() => handleUnblockUser(blockedUser.id, blockedUser.username)}
                  >
                    <ButtonText color={darkTheme.textPrimary} fontSize="$sm">
                      Unblock
                    </ButtonText>
                  </Button>
                </HStack>
              ))}
            </VStack>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
