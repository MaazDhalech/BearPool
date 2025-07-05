import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
import {
    Avatar,
    AvatarImage,
    Box,
    Button,
    HStack,
    Heading,
    ScrollView,
    Text,
    VStack
} from "@gluestack-ui/themed";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { Alert, TouchableOpacity } from "react-native";

// Default avatar image
const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function UserProfileScreen() {
  const { isLoaded, userId: currentUserId } = useAuth();
  const router = useRouter();
  const { userId } = useLocalSearchParams(); // The user ID of the profile being viewed
  
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
          Alert.alert("Error", "User profile not found.");
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
        Alert.alert("Error", "Failed to load user profile.");
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
        
        Alert.alert(
          "Shared Rides Found",
          `You and ${userProfile?.first_name || userProfile?.username || 'this user'} are both members of ${sharedRides.length} ride(s):\n\n${ridesList}\n\nWould you like to leave these rides before blocking this user?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setIsBlocking(false)
            },
            {
              text: "Block Only",
              style: "destructive",
              onPress: () => proceedWithBlock(false, [])
            },
            {
              text: "Leave Rides & Block",
              style: "destructive",
              onPress: () => proceedWithBlock(true, sharedRides)
            }
          ]
        );
      } else {
        // No shared rides, proceed with normal block confirmation
        Alert.alert(
          "Block User",
          `Are you sure you want to block ${userProfile?.first_name || userProfile?.username || 'this user'}? You won't see their posts or be able to interact with them.`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setIsBlocking(false)
            },
            {
              text: "Block",
              style: "destructive",
              onPress: () => proceedWithBlock(false, [])
            }
          ]
        );
      }
    } catch (error) {
      console.error("Error checking shared rides:", error);
      setIsBlocking(false);
      Alert.alert("Error", "Failed to check shared rides. Please try again.");
    }
  };

  const proceedWithBlock = async (shouldLeaveRides: boolean, sharedRides: any[]) => {
    try {
      // Leave shared rides if requested
      if (shouldLeaveRides && sharedRides.length > 0) {
        const success = await leaveSharedRides(sharedRides);
        if (!success) {
          Alert.alert("Error", "Failed to leave some rides. Please try again.");
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
        
      Alert.alert("Success", successMessage, [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error("Error blocking user:", error);
      Alert.alert("Error", "Failed to block user. Please try again.");
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUserId || !userId || isBlocking) return;

    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock ${userProfile?.first_name || userProfile?.username || 'this user'}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setIsBlocking(true);
            try {
              // Get current blocked users list
              const currentUserDocRef = doc(db, "users", currentUserId);
              const currentUserSnap = await getDoc(currentUserDocRef);
              
              if (currentUserSnap.exists()) {
                const currentBlockedUsers = currentUserSnap.data().blockedUsers || [];
                const updatedBlockedUsers = currentBlockedUsers.filter((id: string) => id !== userId);
                
                await updateDoc(currentUserDocRef, {
                  blockedUsers: updatedBlockedUsers
                });
                
                setIsBlocked(false);
                Alert.alert("Success", "User has been unblocked.");
              }
            } catch (error) {
              console.error("Error unblocking user:", error);
              Alert.alert("Error", "Failed to unblock user. Please try again.");
            } finally {
              setIsBlocking(false);
            }
          }
        }
      ]
    );
  };

  if (!isLoaded || loading) {
    return (
      <Box flex={1} bg="#121212" justifyContent="center" alignItems="center">
        <Text color="#a0a0a0">Loading profile...</Text>
      </Box>
    );
  }

  if (!userProfile) {
    return (
      <Box flex={1} bg="#121212" justifyContent="center" alignItems="center">
        <Text color="#a0a0a0">Profile not found</Text>
        <Button
          mt="$4"
          variant="outline"
          borderColor="#333"
          onPress={() => router.back()}
        >
          <Text color="white">Go Back</Text>
        </Button>
      </Box>
    );
  }

  const initials = (userProfile.first_name?.[0] || "") + (userProfile.last_name?.[0] || "") || userProfile.username?.[0] || "U";

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
      <Box flex={1} bg="#121212" px="$4" py="$6">
        <HStack justifyContent="space-between" alignItems="center" mb="$6" mt="$8">
          <Heading size="xl" color="white">
            Profile
          </Heading>
          <TouchableOpacity onPress={() => router.back()}>
            <Text color="#3a7bd5" fontSize="$lg">Done</Text>
          </TouchableOpacity>
        </HStack>

        <VStack space="lg" alignItems="center">
          <Avatar size="2xl" bg="#1e1e1e" borderRadius="$full" mb="$4">
            {userProfile.avatar ? (
              <AvatarImage source={{ uri: userProfile.avatar }} alt="Avatar" />
            ) : (
              <Avatar.FallbackText color="white">
                {initials}
              </Avatar.FallbackText>
            )}
          </Avatar>

          <HStack space="xl" w="100%" justifyContent="space-evenly">
            <VStack alignItems="center">
              <Text color="#a0a0a0">Rides Joined</Text>
              <Text color="white" fontWeight="$bold" fontSize="$xl">
                {userProfile.ridesJoined || 0}
              </Text>
            </VStack>
            <VStack alignItems="center">
              <Text color="#a0a0a0">Rides Hosted</Text>
              <Text color="white" fontWeight="$bold" fontSize="$xl">
                {userProfile.ridesHosted || 0}
              </Text>
            </VStack>
          </HStack>

          <VStack space="sm" w="100%" mt="$6">
            <Text color="#a0a0a0">Name</Text>
            <Text color="white" fontSize="$lg" fontWeight="$semibold">
              {userProfile.first_name && userProfile.last_name 
                ? `${userProfile.first_name} ${userProfile.last_name}`
                : userProfile.username || "Unknown User"}
            </Text>

            <Text color="#a0a0a0" mt="$4">Username</Text>
            <Text color="white" fontSize="$lg" fontWeight="$semibold">
              {userProfile.username || "Not set"}
            </Text>

            <Text color="#a0a0a0" mt="$4">Gender</Text>
            <Text color="white" fontSize="$lg" fontWeight="$semibold">
              {userProfile.gender === "M"
                ? "Male"
                : userProfile.gender === "F"
                ? "Female"
                : userProfile.gender === "NB"
                ? "Non-binary"
                : "Not specified"}
            </Text>

            <Text color="#a0a0a0" mt="$4">Member Since</Text>
            <Text color="white" fontSize="$lg" fontWeight="$semibold">
              {userProfile.createdAt 
                ? new Date(userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : userProfile.createdAt).toLocaleDateString()
                : "Unknown"}
            </Text>
          </VStack>

          <VStack space="md" mt="$8" w="100%">
            {isBlocked ? (
              <Button
                bg="#666"
                onPress={handleUnblockUser}
                disabled={isBlocking}
              >
                <Text color="white" fontWeight="$semibold">
                  {isBlocking ? "Unblocking..." : "Unblock User"}
                </Text>
              </Button>
            ) : (
              <Button
                bg="#ff4444"
                onPress={handleBlockUser}
                disabled={isBlocking}
              >
                <Text color="white" fontWeight="$semibold">
                  {isBlocking ? "Checking rides..." : "Block User"}
                </Text>
              </Button>
            )}
            
            <Button
              variant="outline"
              borderColor="#333"
              onPress={() => router.back()}
            >
              <Text color="white">Go Back</Text>
            </Button>
          </VStack>
        </VStack>
      </Box>
    </ScrollView>
  );
}