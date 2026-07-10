import { darkTheme } from "@/constants/theme";
import { LoadingState } from "@/components/ui/LoadingState";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { getConversationId } from "@/utils/conversations";
import {
    Avatar,
    AvatarImage,
    Box,
    Button,
    HStack,
    ScrollView,
    Text,
    VStack
} from "@gluestack-ui/themed";
import { useLocalSearchParams, useRouter } from "expo-router";
import { NavHeader } from "@/components/ui/NavHeader";
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { confirm, showMenu, toast } from "@/components/ui/Dialog";

// Default avatar image
const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function UserProfileScreen() {
  const { isLoaded, userId: currentUserId } = useFirebaseAuth();
  const router = useRouter();
  const { userId, id: rideIdParam } = useLocalSearchParams();
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    if (!isLoaded || !currentUserId || !userId) return;

    const fetchUserProfile = async () => {
      try {
        // Fetch the user's profile
        const userDocRef = doc(db, "users", userId as string);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          toast("User profile not found.", { type: "error" });
          router.back();
          return;
        }

        const userData = {
          ...userSnap.data(),
          avatar: typeof userSnap.data().avatar === "string" 
            ? userSnap.data().avatar 
            : DEFAULT_AVATAR,
        };

        setUserProfile(userData);

        // Check if current user has blocked this user
        const currentUserDocRef = doc(db, "users", currentUserId);
        const currentUserSnap = await getDoc(currentUserDocRef);
        
        if (currentUserSnap.exists()) {
          const blockedUsers = currentUserSnap.data().blockedUsers || [];
          setIsBlocked(blockedUsers.includes(userId));
        }

      } catch (error) {
        console.error("Error fetching user profile:", error);
        toast("Failed to load user profile.", { type: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [isLoaded, currentUserId, userId]);

  const findSharedRides = async () => {
    try {
      const ridesRef = collection(db, "rides");
      const q = query(
        ridesRef,
        where("memberIds", "array-contains", currentUserId)
      );
      
      const querySnapshot = await getDocs(q);
      const sharedRides: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const rideData = doc.data();
        // Check if both current user and the user being blocked are in memberIds
        if (rideData.memberIds.includes(userId)) {
          sharedRides.push({
            id: doc.id,
            ...rideData
          });
        }
      });
      
      return sharedRides;
    } catch (error) {
      console.error("Error finding shared rides:", error);
      return [];
    }
  };

  const leaveSharedRides = async (sharedRides: any[]) => {
    try {
      const promises = sharedRides.map(async (ride) => {
        const rideDocRef = doc(db, "rides", ride.id);
        await updateDoc(rideDocRef, {
          memberIds: arrayRemove(currentUserId)
        });
      });
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error("Error leaving shared rides:", error);
      return false;
    }
  };

  const formatRideLocation = (ride: any) => {
    const fromLocation = ride.from?.name || ride.from || "Unknown";
    const toLocation = ride.to?.name || ride.to || "Unknown";
    return `${fromLocation} → ${toLocation}`;
  };

  const handleBlockUser = async () => {
    if (!currentUserId || !userId || isBlocking) return;

    setIsBlocking(true);
    
    try {
      // First, check for shared rides
      const sharedRides = await findSharedRides();
      
      if (sharedRides.length > 0) {
        // Show alert with ride information using formatted locations
        const ridesList = sharedRides.map(ride => formatRideLocation(ride)).join("\n");
        
        showMenu({
          title: "Shared Rides Found",
          message: `You and ${userProfile?.first_name || userProfile?.username || 'this user'} are both members of ${sharedRides.length} ride(s):\n\n${ridesList}\n\nWould you like to leave these rides before blocking this user?`,
          onCancel: () => setIsBlocking(false),
          options: [
            { label: "Block Only", destructive: true, onPress: () => proceedWithBlock(false, []) },
            { label: "Leave Rides & Block", destructive: true, onPress: () => proceedWithBlock(true, sharedRides) },
          ],
        });
      } else {
        // No shared rides, proceed with normal block confirmation
        const ok = await confirm({
          title: "Block User",
          message: `Are you sure you want to block ${userProfile?.first_name || userProfile?.username || 'this user'}? You won't see their posts or be able to interact with them.`,
          confirmText: "Block",
          destructive: true,
        });
        if (ok) proceedWithBlock(false, []);
        else setIsBlocking(false);
      }
    } catch (error) {
      console.error("Error checking shared rides:", error);
      setIsBlocking(false);
      toast("Failed to check shared rides. Please try again.", { type: "error" });
    }
  };

  const proceedWithBlock = async (shouldLeaveRides: boolean, sharedRides: any[]) => {
    try {
      // Leave shared rides if requested
      if (shouldLeaveRides && sharedRides.length > 0) {
        const success = await leaveSharedRides(sharedRides);
        if (!success) {
          toast("Failed to leave some rides. Please try again.", { type: "error" });
          setIsBlocking(false);
          return;
        }
      }

      // Block the user
      const currentUserDocRef = doc(db, "users", currentUserId!);
      await updateDoc(currentUserDocRef, {
        blockedUsers: arrayUnion(userId)
      });
      
      setIsBlocked(true);
      
      const successMessage = shouldLeaveRides && sharedRides.length > 0
        ? `You have left ${sharedRides.length} shared ride(s) and blocked this user.`
        : "User has been blocked.";
        
      toast(successMessage, { type: "success" });
      router.back();
    } catch (error) {
      console.error("Error blocking user:", error);
      toast("Failed to block user. Please try again.", { type: "error" });
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUserId || !userId || isBlocking) return;

    const ok = await confirm({
      title: "Unblock User",
      message: `Are you sure you want to unblock ${userProfile?.first_name || userProfile?.username || 'this user'}?`,
      confirmText: "Unblock",
    });
    if (!ok) return;

    setIsBlocking(true);
    try {
      const currentUserDocRef = doc(db, "users", currentUserId);
      const currentUserSnap = await getDoc(currentUserDocRef);

      if (currentUserSnap.exists()) {
        const currentBlockedUsers = currentUserSnap.data().blockedUsers || [];
        const updatedBlockedUsers = currentBlockedUsers.filter((id: string) => id !== userId);

        await updateDoc(currentUserDocRef, {
          blockedUsers: updatedBlockedUsers
        });

        setIsBlocked(false);
        toast("User has been unblocked.", { type: "success" });
      }
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast("Failed to unblock user. Please try again.", { type: "error" });
    } finally {
      setIsBlocking(false);
    }
  };

  const handleReportUser = () => {
    if (!userId) return;
    const params: Record<string, string> = {
      userId: String(userId),
    };
    if (rideIdParam) {
      params.rideId = String(rideIdParam);
    }

    router.push({
      pathname: "/(stack)/settings/report-user",
      params,
    });
  };

  if (!isLoaded || loading) {
    return (
      <Box flex={1} bg={darkTheme.bg} justifyContent="center" alignItems="center">
        <LoadingState label="Loading profile…" />
      </Box>
    );
  }

  if (!userProfile) {
    return (
      <Box flex={1} bg={darkTheme.bg} justifyContent="center" alignItems="center">
        <Text color={darkTheme.textSecondary}>Profile not found</Text>
        <Button
          mt="$4"
          variant="solid"
          bg={darkTheme.raised}
          onPress={() => router.back()}
        >
          <Text color={darkTheme.textPrimary}>Go Back</Text>
        </Button>
      </Box>
    );
  }

  const initials = (userProfile.first_name?.[0] || "") + (userProfile.last_name?.[0] || "") || userProfile.username?.[0] || "U";

  return (
    <Box flex={1} bg={darkTheme.bg}>
      <NavHeader title="Profile" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Box flex={1} bg={darkTheme.bg} px="$4" py="$6">

        <VStack space="lg" alignItems="center">
          <Avatar size="2xl" bg={darkTheme.surface} borderRadius="$full" mb="$4">
            {userProfile.avatar ? (
              <AvatarImage source={{ uri: userProfile.avatar }} alt="Avatar" />
            ) : (
              <Avatar.FallbackText color={darkTheme.textPrimary}>
                {initials}
              </Avatar.FallbackText>
            )}
          </Avatar>

          <HStack space="xl" w="100%" justifyContent="space-evenly">
            <VStack alignItems="center">
              <Text color={darkTheme.textSecondary}>Rides Joined</Text>
              <Text color={darkTheme.textPrimary} fontWeight="$bold" fontSize="$xl">
                {userProfile.ridesJoined || 0}
              </Text>
            </VStack>
            <VStack alignItems="center">
              <Text color={darkTheme.textSecondary}>Rides Hosted</Text>
              <Text color={darkTheme.textPrimary} fontWeight="$bold" fontSize="$xl">
                {userProfile.ridesHosted || 0}
              </Text>
            </VStack>
          </HStack>

          <VStack space="sm" w="100%" mt="$6">
            <Text color={darkTheme.textSecondary}>Name</Text>
            <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="$semibold">
              {userProfile.first_name && userProfile.last_name 
                ? `${userProfile.first_name} ${userProfile.last_name}`
                : userProfile.username || "Unknown User"}
            </Text>

            <Text color={darkTheme.textSecondary} mt="$4">Username</Text>
            <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="$semibold">
              {userProfile.username || "Not set"}
            </Text>

            <Text color={darkTheme.textSecondary} mt="$4">Gender</Text>
            <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="$semibold">
              {userProfile.gender === "M"
                ? "Male"
                : userProfile.gender === "F"
                ? "Female"
                : userProfile.gender === "NB"
                ? "Non-binary"
                : "Not specified"}
            </Text>

            <Text color={darkTheme.textSecondary} mt="$4">Member Since</Text>
            <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="$semibold">
              {userProfile.createdAt 
                ? new Date(userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : userProfile.createdAt).toLocaleDateString()
                : "Unknown"}
            </Text>
          </VStack>

          <VStack space="md" mt="$8" w="100%">
            {currentUserId && currentUserId !== String(userId) && !isBlocked && (
              <Button
                bg={ACCENT}
                onPress={() =>
                  router.push(
                    `/(stack)/dm/${getConversationId(currentUserId, String(userId))}`
                  )
                }
              >
                <Text color="#121212" fontWeight="$semibold">
                  Message
                </Text>
              </Button>
            )}

            {isBlocked ? (
              <Button
                bg={darkTheme.textMuted}
                onPress={handleUnblockUser}
                disabled={isBlocking}
              >
                <Text color={darkTheme.textPrimary} fontWeight="$semibold">
                  {isBlocking ? "Unblocking..." : "Unblock User"}
                </Text>
              </Button>
            ) : (
              <Button
                bg={darkTheme.error}
                onPress={handleBlockUser}
                disabled={isBlocking}
              >
                <Text color={darkTheme.textPrimary} fontWeight="$semibold">
                  {isBlocking ? "Checking rides..." : "Block User"}
                </Text>
              </Button>
            )}

            <Button
              variant="solid"
              bg="#3a1f1f"
              onPress={handleReportUser}
            >
              <Text color={darkTheme.danger} fontWeight="$semibold">Report User</Text>
            </Button>

            <Button
              variant="solid"
              bg={darkTheme.raised}
              onPress={() => router.back()}
            >
              <Text color={darkTheme.textPrimary}>Go Back</Text>
            </Button>
          </VStack>
        </VStack>
      </Box>
      </ScrollView>
    </Box>
  );
}
