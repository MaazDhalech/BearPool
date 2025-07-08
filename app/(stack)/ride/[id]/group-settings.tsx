import { db } from "@/services/firebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  Heading,
  HStack,
  Pressable,
  ScrollView,
  Text,
  VStack
} from "@gluestack-ui/themed";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  arrayRemove,
  doc,
  getDoc,
  increment,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

type User = {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
};

export default function GroupSettings() {
  const { id: rideId } = useLocalSearchParams();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchRideAndUsers = async () => {
      if (!rideId) return;

      const rideRef = doc(db, "rides", String(rideId));
      const rideSnap = await getDoc(rideRef);
      if (!rideSnap.exists()) return;

      const rideData = rideSnap.data();
      setRide(rideData);

      const memberIds: string[] = rideData.memberIds || [];
      const usersData: User[] = [];

      for (const uid of memberIds) {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          usersData.push({
            id: uid,
            name:
              [data.first_name, data.last_name].filter(Boolean).join(" ") ||
              data.username ||
              "Anonymous",
            username: data.username || "No username",
            avatar: data.avatar || DEFAULT_AVATAR,
          });
        } else {
          usersData.push({
            id: uid,
            name: "Unknown",
            username: "Unavailable",
            avatar: DEFAULT_AVATAR,
          });
        }
      }

      setUsers(usersData);
    };

    fetchRideAndUsers();
  }, [rideId]);

  const handleKick = async (uid: string) => {
    if (!rideId) return;
    Alert.alert("Remove Member", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const rideRef = doc(db, "rides", String(rideId));

            // First get current ride data
            const rideSnap = await getDoc(rideRef);
            if (!rideSnap.exists()) throw new Error("Ride not found");

            const currentSeats = rideSnap.data().seats || 0;
            console.log("Current seats before update:", currentSeats);

            await updateDoc(rideRef, {
              memberIds: arrayRemove(uid),
              seats: increment(1),
            });

            // Verify update
            const updatedSnap = await getDoc(rideRef);
            console.log("Seats after update:", updatedSnap.data()?.seats);

            setUsers((prev) => prev.filter((u) => u.id !== uid));
          } catch (error) {
            console.error("Error removing member:", error);
            Alert.alert("Error", "Failed to remove member");
          }
        },
      },
    ]);
  };

  const handleAssignHost = (newHostId: string) => {
    const newHost = users.find(u => u.id === newHostId);
    if (!newHost) return;

    Alert.alert(
      "Assign New Host",
      `Are you sure you want to make ${newHost.name} the new host? You will no longer be the host of this ride.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Assign",
          style: "default",
          onPress: async () => {
            try {
              const rideRef = doc(db, "rides", String(rideId));
              await updateDoc(rideRef, {
                hostId: newHostId,
              });

              // Update local state
              setRide((prev: any) => ({ ...prev, hostId: newHostId }));
              
              Alert.alert("Success", `${newHost.name} is now the host. You can now leave the ride if you wish.`);
            } catch (error) {
              console.error("Error assigning new host:", error);
              Alert.alert("Error", "Failed to assign new host");
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = async () => {
    if (!rideId || !user?.id) return;

    const isHost = user?.id === ride.hostId;
    const otherMembers = users.filter(u => u.id !== user?.id);

    // If host is trying to leave and there are other members, show assign host options
    if (isHost && otherMembers.length > 0) {
      Alert.alert(
        "Assign New Host",
        "You must assign a new host before leaving the ride.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Choose New Host",
            style: "default",
            onPress: () => {
              // Show options to select new host
              const buttons = otherMembers.map(member => ({
                text: member.name,
                onPress: () => handleAssignHost(member.id),
              }));
              buttons.push({ text: "Cancel", style: "cancel" });

              Alert.alert("Select New Host", "Choose who will be the new host:", buttons);
            },
          },
        ]
      );
      return;
    }

    // If host is trying to leave and no other members, or if regular member is leaving
    Alert.alert(
      "Leave Group", 
      isHost && otherMembers.length === 0 
        ? "You are the only member left. Leaving will delete this ride. Are you sure?"
        : "Are you sure you want to leave this ride?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const rideRef = doc(db, "rides", String(rideId));

              // First get current ride data
              const rideSnap = await getDoc(rideRef);
              if (!rideSnap.exists()) throw new Error("Ride not found");

              const currentSeats = rideSnap.data().seats || 0;
              console.log("Current seats before update:", currentSeats);

              await updateDoc(rideRef, {
                memberIds: arrayRemove(user.id),
                seats: increment(1),
              });

              // Verify update
              const updatedSnap = await getDoc(rideRef);
              console.log("Seats after update:", updatedSnap.data()?.seats);

              router.replace("/(tabs)/chats");
            } catch (error) {
              console.error("Error leaving group:", error);
              Alert.alert("Error", "Failed to leave group");
            }
          },
        },
      ]
    );
  };

  const handleAvatarPress = (userId: string) => {
    if (userId === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push(`/(stack)/ride/${rideId}/viewProfile?userId=${userId}`);
    }
  };

  if (!ride) return null;

  const isHost = user?.id === ride.hostId;
  const otherMembers = users.filter(u => u.id !== user?.id);
  const hostCanLeave = !isHost || otherMembers.length === 0;

  return (
    <Box flex={1} bg="#121212" pt={insets.top}>
      {/* Header with Back Button and Title */}
      <HStack
        alignItems="center"
        px="$4"
        py="$3"
        borderBottomWidth="$1"
        borderBottomColor="#333"
      >
        <Pressable
          onPress={() => router.back()}
          p="$2"
          borderRadius="$full"
          mr="$3"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Heading size="lg" color="white" flex={1}>
          Group Settings
        </Heading>
      </HStack>

      <ScrollView px="$4" py="$4">
        <VStack space="lg">
          {users.map((u) => (
            <HStack
              key={u.id}
              alignItems="center"
              justifyContent="space-between"
              bg="#1e1e1e"
              p="$4"
              borderRadius="$lg"
            >
              <HStack space="sm" alignItems="center">
                <Pressable onPress={() => handleAvatarPress(u.id)}>
                  <Avatar size="md">
                    <AvatarImage source={{ uri: u.avatar }} />
                  </Avatar>
                </Pressable>
                <VStack>
                  <HStack alignItems="center" space="xs">
                    <Text color="white" fontWeight="$medium">
                      {u.name}
                    </Text>
                    {u.id === ride.hostId && (
                      <Text color="#00cc88" fontSize="$xs" fontWeight="$bold">
                        (Host)
                      </Text>
                    )}
                  </HStack>
                  <Text color="#aaaaaa" fontSize="$sm">
                    @{u.username}
                  </Text>
                </VStack>
              </HStack>
              {isHost && u.id !== user?.id && (
                <HStack space="sm">
                  <Button
                    size="sm"
                    backgroundColor="#00cc88"
                    onPress={() => handleAssignHost(u.id)}
                  >
                    <Text color="white">Make Host</Text>
                  </Button>
                  <Button
                    size="sm"
                    backgroundColor="#ff5555"
                    onPress={() => handleKick(u.id)}
                  >
                    <Text color="white">Remove</Text>
                  </Button>
                </HStack>
              )}
            </HStack>
          ))}

          <Button
            mt="$6"
            size="md"
            variant="outline"
            borderColor={hostCanLeave ? "#ff5555" : "#666666"}
            backgroundColor={hostCanLeave ? "transparent" : "#333333"}
            opacity={hostCanLeave ? 1 : 0.6}
            onPress={hostCanLeave ? handleLeaveGroup : () => {
              Alert.alert(
                "Cannot Leave",
                "You must assign a new host before leaving the ride.",
                [{ text: "OK", style: "default" }]
              );
            }}
          >
            <Text color={hostCanLeave ? "#ff5555" : "#666666"}>
              Leave Group
            </Text>
          </Button>
        </VStack>
      </ScrollView>
    </Box>
  );
}