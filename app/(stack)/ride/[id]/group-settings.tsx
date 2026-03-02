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
  Icon,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  arrayRemove,
  deleteDoc,
  doc,
  getDoc,
  increment,
  updateDoc,
  setDoc,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { Menu as MenuIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Modal, TextInput, TouchableOpacity, View } from "react-native";
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
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Kick modal states
  const [showKickModal, setShowKickModal] = useState(false);
  const [userToKick, setUserToKick] = useState<User | null>(null);
  const [kickReason, setKickReason] = useState("");
  const [customKickReason, setCustomKickReason] = useState("");
  const [kickSubmitting, setKickSubmitting] = useState(false);

  const deletionReasons = [
    "No longer needed",
    "Found alternative transportation",
    "Change in plans",
    "Low passenger interest",
    "Technical issues",
    "Safety concerns",
    "Other",
  ];

  const kickReasons = [
    "Inappropriate behavior",
    "No-show for ride",
    "Safety concerns",
    "Requested to leave",
    "Violation of ride rules",
    "Communication issues",
    "Other",
  ];

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

  // If the ride has no host (e.g. previous host deleted account), promote the current user
  useEffect(() => {
    if (!ride || !user?.id) return;
    const memberIds: string[] = ride.memberIds ?? [];
    if (!ride.hostId && memberIds.includes(user.id)) {
      updateDoc(doc(db, "rides", String(rideId)), { hostId: user.id });
      setRide((prev: any) => ({ ...prev, hostId: user.id }));
    }
  }, [ride?.hostId, user?.id]);

  const storeKickRecord = async (
    kickedUserId: string,
    kickedUserName: string,
    reason: string,
  ) => {
    try {
      // Create a reference to the ride's kickLogs subcollection
      const kickLogsCollectionRef = collection(
        db,
        "rides",
        String(rideId),
        "kickLogs",
      );

      // Create a new document in the kickLogs subcollection
      const kickRecordRef = doc(kickLogsCollectionRef);

      await setDoc(kickRecordRef, {
        rideId: String(rideId),
        kickedUserId,
        kickedUserName,
        kickedBy: user?.id,
        kickedByName: user?.fullName || "Unknown",
        reason,
        timestamp: serverTimestamp(),
        rideFrom: ride?.from || "Unknown",
        rideTo: ride?.to || "Unknown",
        rideDate: ride?.date || "Unknown",
      });

      console.log(
        "Kick record stored successfully in ride's kickLogs subcollection",
      );
    } catch (error) {
      console.error("Error storing kick record:", error);
    }
  };

  const handleKick = async (uid: string) => {
    if (!rideId) return;

    const userToRemove = users.find((u) => u.id === uid);
    if (!userToRemove) return;

    // Show kick reason modal
    setUserToKick(userToRemove);
    setShowKickModal(true);
  };

  const proceedWithKick = async () => {
    if (!userToKick || !rideId) return;

    if (!kickReason) {
      Alert.alert("Error", "Please select a reason for removing this member.");
      return;
    }

    if (kickReason === "Other" && !customKickReason.trim()) {
      Alert.alert("Error", "Please provide a reason for removal.");
      return;
    }

    const finalReason = kickReason === "Other" ? customKickReason : kickReason;

    setKickSubmitting(true);

    try {
      const rideRef = doc(db, "rides", String(rideId));

      // First get current ride data
      const rideSnap = await getDoc(rideRef);
      if (!rideSnap.exists()) throw new Error("Ride not found");

      const currentSeats = rideSnap.data().seats || 0;
      console.log("Current seats before update:", currentSeats);

      await updateDoc(rideRef, {
        memberIds: arrayRemove(userToKick.id),
        seats: increment(1),
        [`kickedBy.${userToKick.id}`]: user?.id ?? null,
      });

      // Store kick record in the ride's kickLogs subcollection
      await storeKickRecord(
        userToKick.id,
        userToKick.name || "Unknown",
        finalReason,
      );

      // Verify update
      const updatedSnap = await getDoc(rideRef);
      console.log("Seats after update:", updatedSnap.data()?.seats);

      setUsers((prev) => prev.filter((u) => u.id !== userToKick.id));

      // Close modal and reset
      setShowKickModal(false);
      setUserToKick(null);
      setKickReason("");
      setCustomKickReason("");

      Alert.alert("Success", "Member removed successfully");
    } catch (error) {
      console.error("Error removing member:", error);
      Alert.alert("Error", "Failed to remove member");
    } finally {
      setKickSubmitting(false);
    }
  };

  const handleAssignHost = (newHostId: string) => {
    const newHost = users.find((u) => u.id === newHostId);
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

              // Write system message — triggers push notifications via Cloud Function
              const messagesRef = collection(
                db,
                "rides",
                String(rideId),
                "messages",
              );
              await addDoc(messagesRef, {
                text: `${newHost.username} has been made the host`,
                senderId: null,
                senderName: "System",
                timestamp: serverTimestamp(),
                system: true,
                archivedNotice: false,
              });

              // Update local state
              setRide((prev: any) => ({ ...prev, hostId: newHostId }));

              Alert.alert(
                "Success",
                `${newHost.name} is now the host. You can now leave the ride if you wish.`,
              );
            } catch (error) {
              console.error("Error assigning new host:", error);
              Alert.alert("Error", "Failed to assign new host");
            }
          },
        },
      ],
    );
  };

  const sendRideDeletionEmail = async (reason: string) => {
    if (!ride || !user) return false;

    try {
      const web3formsApiKey = Constants.expoConfig?.extra?.web3formsApiKey;

      if (!web3formsApiKey) {
        console.error("Web3Forms API key not configured");
        return false;
      }

      // Format date and time - using the correct ride data structure
      const formatDateTime = () => {
        // Try different possible date/time fields based on your ride posting component
        if (ride.date && ride.time) {
          // If you have separate date and time strings from the posting component
          return `${ride.date} at ${ride.time}`;
        } else if (ride.dateTime) {
          // If you have a timestamp field
          const date = ride.dateTime.toDate
            ? ride.dateTime.toDate()
            : new Date(ride.dateTime);
          return date.toLocaleString();
        } else if (ride.createdAt) {
          // Fallback to creation date
          const date = ride.createdAt.toDate
            ? ride.createdAt.toDate()
            : new Date(ride.createdAt);
          return date.toLocaleString();
        } else {
          return "Not specified";
        }
      };

      // Get host details - use the actual ride data structure
      const hostUser = users.find((u) => u.id === ride.hostId);
      const hostName = hostUser?.name || "Unknown";
      const hostEmail =
        user.primaryEmailAddress?.emailAddress || "Not provided";

      // Create detailed message using the actual data structure from your ride posting
      const message = `
RIDE DELETION REPORT
================================
BASIC INFO:
- Ride ID: ${rideId}
- Deleted By: ${user.fullName || "Unknown"} (${hostEmail})
- Deletion Time: ${new Date().toLocaleString()}
- Deletion Reason: ${reason}

RIDE DETAILS:
- Host: ${hostName}
- From: ${ride.from || "Not specified"}
- To: ${ride.to || "Not specified"}
- Date & Time: ${formatDateTime()}
- Seats Available: ${ride.seats || 0}
- Description: ${ride.notes || "None"}
- Gender Preference: ${
        ride.genderPref === "N"
          ? "No preference"
          : ride.genderPref === "M"
            ? "Men only"
            : ride.genderPref === "F"
              ? "Women only"
              : ride.genderPref === "NB"
                ? "Non-binary only"
                : "Not specified"
      }

PASSENGER INFORMATION:
Total Passengers: ${users.length}
${users.map((u, index) => `${index + 1}. ${u.name} (@${u.username})`).join("\n")}

ADDITIONAL NOTES:
${customReason ? `Custom Reason: ${customReason}` : "No additional notes provided."}
================================
This ride has been permanently deleted from the system.
      `.trim();

      const formData = new FormData();
      formData.append("access_key", web3formsApiKey);
      formData.append("name", "Ride Deletion System");
      formData.append("email", hostEmail);
      formData.append(
        "subject",
        `Ride Deleted: ${ride.from ? `${ride.from} → ${ride.to}` : rideId}`,
      );
      formData.append("message", message);
      formData.append("from_name", "Ride Deletion Alert");
      formData.append("replyto", hostEmail);

      // Add ride details as hidden fields for better parsing if needed
      formData.append("ride_id", String(rideId));
      formData.append("host_name", hostName);
      formData.append("deletion_reason", reason);
      formData.append("passenger_count", String(users.length));

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        return true;
      } else {
        throw new Error(result.message || "Failed to send deletion email");
      }
    } catch (error) {
      console.error("Error sending deletion email:", error);
      return false;
    }
  };

  const handleDeleteRide = async (skipFeedback = false) => {
    if (!rideId || !user?.id) return;

    const isHost = user?.id === ride.hostId;

    // Only allow host to delete the ride
    if (!isHost) {
      Alert.alert("Permission Denied", "Only the host can delete this ride.", [
        { text: "OK", style: "default" },
      ]);
      return;
    }

    if (skipFeedback) {
      // Direct deletion without feedback
      proceedWithDeletion("No reason provided");
      return;
    }

    // Show feedback modal
    setShowDeleteModal(true);
  };

  const proceedWithDeletion = async (reason: string) => {
    setSubmitting(true);
    let emailSent = false;

    try {
      // Try to send email notification
      emailSent = await sendRideDeletionEmail(reason);

      const rideRef = doc(db, "rides", String(rideId));

      // First verify the ride exists
      const rideSnap = await getDoc(rideRef);
      if (!rideSnap.exists()) {
        throw new Error("Ride not found");
      }

      // Delete the ride document
      // Note: When a document is deleted, its subcollections (including kickLogs)
      // are also automatically deleted by Firestore
      await deleteDoc(rideRef);

      Alert.alert(
        "Success",
        `Ride deleted successfully.${emailSent ? " A report has been sent to the admin." : " (Report sending failed, but ride was deleted.)"}`,
        [
          {
            text: "OK",
            onPress: () => {
              // Navigate back to chats or home screen
              router.replace("/(tabs)/chats");
            },
          },
        ],
      );
    } catch (error) {
      console.error("Error deleting ride:", error);
      Alert.alert("Error", "Failed to delete ride. Please try again.", [
        { text: "OK", style: "default" },
      ]);
    } finally {
      setSubmitting(false);
      setShowDeleteModal(false);
      setDeletionReason("");
      setCustomReason("");
    }
  };

  const handleSubmitDeletion = () => {
    if (!deletionReason) {
      Alert.alert("Error", "Please select a reason for deleting the ride.");
      return;
    }

    if (deletionReason === "Other" && !customReason.trim()) {
      Alert.alert("Error", "Please provide a reason for deletion.");
      return;
    }

    const finalReason =
      deletionReason === "Other" ? customReason : deletionReason;
    proceedWithDeletion(finalReason);
  };

  const handleLeaveGroup = async () => {
    if (!rideId || !user?.id) return;

    const isHost = user?.id === ride.hostId;
    const otherMembers = users.filter((u) => u.id !== user?.id);

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
              const buttons = otherMembers.map((member) => ({
                text: member.name,
                onPress: () => handleAssignHost(member.id),
              }));
              buttons.push({ text: "Cancel", onPress: () => {} });

              Alert.alert(
                "Select New Host",
                "Choose who will be the new host:",
                buttons,
              );
            },
          },
          // Add option to delete ride instead
          {
            text: "Delete Ride",
            style: "destructive",
            onPress: () => handleDeleteRide(false), // Show feedback for deletion
          },
        ],
      );
      return;
    }

    // If host is trying to leave and no other members, or if regular member is leaving
    Alert.alert(
      "Leave Group",
      isHost && otherMembers.length === 0
        ? "You are the only member left. Would you like to leave and delete this ride?"
        : "Are you sure you want to leave this ride?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isHost && otherMembers.length === 0 ? "Delete Ride" : "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              // If host is the only member, delete the ride instead of just leaving
              if (isHost && otherMembers.length === 0) {
                handleDeleteRide(true); // Skip feedback when deleting through leave
                return;
              }

              // Regular member leaving or host leaving after assigning new host
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
      ],
    );
  };

  const handleViewProfile = (targetId: string) => {
    if (targetId === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push({
        pathname: "/(stack)/ride/[id]/viewProfile",
        params: { id: String(rideId), userId: targetId },
      });
    }
  };

  if (!ride) return null;

  const memberIds: string[] = ride.memberIds ?? [];
  const isHost = user?.id === ride.hostId || (!ride.hostId && memberIds.includes(user?.id ?? ""));
  const otherMembers = users.filter((u) => u.id !== user?.id);
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
                <Avatar size="md">
                  <AvatarImage source={{ uri: u.avatar }} />
                </Avatar>
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
              <Box position="relative">
                <Pressable
                  onPress={() =>
                    setOpenMenuUserId((prev) => (prev === u.id ? null : u.id))
                  }
                  p="$2"
                  borderRadius="$full"
                >
                  <Icon as={MenuIcon} size="lg" color="#a0a0a0" />
                </Pressable>
                {openMenuUserId === u.id && (
                  <Box
                    position="absolute"
                    top="$8"
                    right={0}
                    bg="#2a2a2a"
                    borderWidth={1}
                    borderColor="#333"
                    borderRadius="$md"
                    px="$3"
                    py="$2"
                    zIndex={10}
                    minWidth={150}
                  >
                    <Pressable
                      onPress={() => {
                        setOpenMenuUserId(null);
                        handleViewProfile(u.id);
                      }}
                      p="$2"
                      borderRadius="$sm"
                      $pressed={{ bg: "#3a3a3a" }}
                    >
                      <Text color="white">View Profile</Text>
                    </Pressable>
                    {isHost && u.id !== user?.id && (
                      <>
                        <Pressable
                          onPress={() => {
                            setOpenMenuUserId(null);
                            handleAssignHost(u.id);
                          }}
                          p="$2"
                          borderRadius="$sm"
                          $pressed={{ bg: "#3a3a3a" }}
                        >
                          <Text color="#00cc88">Make Host</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setOpenMenuUserId(null);
                            handleKick(u.id);
                          }}
                          p="$2"
                          borderRadius="$sm"
                          $pressed={{ bg: "#3a3a3a" }}
                        >
                          <Text color="#ff5555">Remove</Text>
                        </Pressable>
                      </>
                    )}
                  </Box>
                )}
              </Box>
            </HStack>
          ))}

          {/* Delete Ride Button - Only visible to host */}
          {isHost && (
            <Button
              mt="$2"
              size="md"
              variant="outline"
              borderColor="#ff5555"
              backgroundColor="transparent"
              onPress={() => handleDeleteRide(false)}
            >
              <Text color="#ff5555">Delete Ride</Text>
            </Button>
          )}

          <Button
            mt="$6"
            size="md"
            variant="outline"
            borderColor={hostCanLeave ? "#ff5555" : "#666666"}
            backgroundColor={hostCanLeave ? "transparent" : "#333333"}
            opacity={hostCanLeave ? 1 : 0.6}
            onPress={
              hostCanLeave
                ? handleLeaveGroup
                : () => {
                    Alert.alert(
                      "Cannot Leave",
                      "You must assign a new host before leaving the ride.",
                      [{ text: "OK", style: "default" }],
                    );
                  }
            }
          >
            <Text color={hostCanLeave ? "#ff5555" : "#666666"}>
              Leave Group
            </Text>
          </Button>
        </VStack>
      </ScrollView>

      {/* Kick Member Modal */}
      <Modal
        visible={showKickModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !kickSubmitting && setShowKickModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#1e1e1e",
              borderRadius: 16,
              padding: 24,
              maxHeight: "80%",
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Heading color="white" size="lg" mb={2}>
                Remove Member
              </Heading>
              {userToKick && (
                <Text color="white" mb={4} fontSize="$lg">
                  {userToKick.name} (@{userToKick.username})
                </Text>
              )}

              <Text color="#a0a0a0" mb={6}>
                Please select a reason for removing this member. This will be
                stored for record keeping.
              </Text>

              <VStack space="md" mb={6}>
                <Text color="white" fontWeight="bold" fontSize={16}>
                  Select a reason:
                </Text>

                {kickReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setKickReason(reason)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      backgroundColor:
                        kickReason === reason ? "#2a2a2a" : "#252525",
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: kickReason === reason ? "#ff5555" : "#666",
                        backgroundColor:
                          kickReason === reason ? "#ff5555" : "transparent",
                        marginRight: 12,
                      }}
                    />
                    <Text color="white" flex={1}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </VStack>

              {kickReason === "Other" && (
                <VStack space="sm" mb={6}>
                  <Text color="white" fontWeight="bold">
                    Please specify:
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: "#252525",
                      borderColor: "#333",
                      borderWidth: 1,
                      borderRadius: 8,
                      color: "white",
                      padding: 12,
                      minHeight: 100,
                      textAlignVertical: "top",
                      fontSize: 16,
                    }}
                    placeholderTextColor="#666"
                    multiline
                    onChangeText={setCustomKickReason}
                    value={customKickReason}
                    placeholder="Enter your reason for removing this member..."
                  />
                </VStack>
              )}

              <VStack space="sm">
                <Button
                  onPress={proceedWithKick}
                  disabled={kickSubmitting || !kickReason}
                  bg="#ff5555"
                  opacity={kickSubmitting || !kickReason ? 0.6 : 1}
                >
                  {kickSubmitting ? (
                    <HStack space="sm" alignItems="center">
                      <Box
                        width={20}
                        height={20}
                        borderRadius={10}
                        borderWidth={2}
                        borderColor="white"
                        borderTopColor="transparent"
                        style={{ transform: [{ rotate: "360deg" }] }}
                      />
                      <Text color="white">Removing...</Text>
                    </HStack>
                  ) : (
                    <Text color="white" fontWeight="bold">
                      Remove Member
                    </Text>
                  )}
                </Button>

                <Button
                  onPress={() => {
                    if (!kickSubmitting) {
                      setShowKickModal(false);
                      setUserToKick(null);
                      setKickReason("");
                      setCustomKickReason("");
                    }
                  }}
                  disabled={kickSubmitting}
                  variant="outline"
                  borderColor="#666"
                  bg="transparent"
                >
                  <Text color="#a0a0a0">Cancel</Text>
                </Button>
              </VStack>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Deletion Feedback Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !submitting && setShowDeleteModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#1e1e1e",
              borderRadius: 16,
              padding: 24,
              maxHeight: "80%",
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Heading color="white" size="lg" mb={2}>
                Delete Ride
              </Heading>
              {ride.from && ride.to ? (
                <Text color="white" mb={4} fontSize="$lg">
                  {ride.from} → {ride.to}
                </Text>
              ) : (
                <Text color="white" mb={4} fontSize="$lg">
                  Untitled Ride
                </Text>
              )}

              <Text color="#a0a0a0" mb={6}>
                Please help us improve by telling us why you're deleting this
                ride. A report with ride details will be sent to the admin.
              </Text>

              <VStack space="md" mb={6}>
                <Text color="white" fontWeight="bold" fontSize={16}>
                  Select a reason for deletion:
                </Text>

                {deletionReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setDeletionReason(reason)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      backgroundColor:
                        deletionReason === reason ? "#2a2a2a" : "#252525",
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          deletionReason === reason ? "#9C27B0" : "#666",
                        backgroundColor:
                          deletionReason === reason ? "#9C27B0" : "transparent",
                        marginRight: 12,
                      }}
                    />
                    <Text color="white" flex={1}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </VStack>
              {deletionReason === "Other" && (
                <VStack space="sm" mb={6}>
                  <Text color="white" fontWeight="bold">
                    Please specify:
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: "#252525",
                      borderColor: "#333",
                      borderWidth: 1,
                      borderRadius: 8,
                      color: "white",
                      padding: 12,
                      minHeight: 100,
                      textAlignVertical: "top",
                      fontSize: 16,
                    }}
                    placeholderTextColor="#666"
                    multiline
                    onChangeText={setCustomReason}
                    value={customReason}
                    placeholder="Enter your reason for deleting this ride..."
                  />
                </VStack>
              )}

              <VStack space="sm">
                <Button
                  onPress={handleSubmitDeletion}
                  disabled={submitting || !deletionReason}
                  bg="#9C27B0"
                  opacity={submitting || !deletionReason ? 0.6 : 1}
                >
                  {submitting ? (
                    <HStack space="sm" alignItems="center">
                      <Box
                        width={20}
                        height={20}
                        borderRadius={10}
                        borderWidth={2}
                        borderColor="white"
                        borderTopColor="transparent"
                        style={{ transform: [{ rotate: "360deg" }] }}
                      />
                      <Text color="white">Deleting...</Text>
                    </HStack>
                  ) : (
                    <Text color="white" fontWeight="bold">
                      Delete Ride & Send Report
                    </Text>
                  )}
                </Button>

                <Button
                  onPress={() => {
                    if (!submitting) {
                      setShowDeleteModal(false);
                      setDeletionReason("");
                      setCustomReason("");
                    }
                  }}
                  disabled={submitting}
                  variant="outline"
                  borderColor="#666"
                  bg="transparent"
                >
                  <Text color="#a0a0a0">Cancel</Text>
                </Button>
              </VStack>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Box>
  );
}
