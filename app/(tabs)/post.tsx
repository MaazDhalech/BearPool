// app/(tabs)/post.tsx

import { db } from "@/services/firebaseConfig";
import {
  Box,
  Button,
  HStack,
  Heading,
  Input,
  InputField,
  ScrollView,
  Text,
  VStack,
  useToast,
} from "@gluestack-ui/themed";
import { Timestamp, addDoc, collection } from "firebase/firestore";
import { useState } from "react";

export default function PostScreen() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState("1"); // ✅ initialized to "1"
  const [notes, setNotes] = useState("");

  const toast = useToast();

  const handleSubmit = async () => {
    if (!from || !to || !date || !time || !seats) {
      toast.show({
        placement: "top",
        duration: 3000,
        render: () => (
          <Box bg="$red600" px="$4" py="$3" borderRadius="$md">
            <Text color="white" fontWeight="$bold">Missing Fields</Text>
            <Text color="white">Please fill out all required fields.</Text>
          </Box>
        ),
      });
      return;
    }

    try {
      await addDoc(collection(db, "rides"), {
        from,
        to,
        date,
        time,
        seats: Number(seats),
        notes,
        createdAt: Timestamp.now(),
      });

      toast.show({
        placement: "top",
        duration: 3000,
        render: () => (
          <Box bg="$green600" px="$4" py="$3" borderRadius="$md">
            <Text color="white" fontWeight="$bold">Ride Posted!</Text>
            <Text color="white">Your ride has been successfully added.</Text>
          </Box>
        ),
      });

      setFrom("");
      setTo("");
      setDate("");
      setTime("");
      setSeats("1"); // ✅ reset to "1"
      setNotes("");
    } catch (error) {
      toast.show({
        placement: "top",
        duration: 3000,
        render: () => (
          <Box bg="$red600" px="$4" py="$3" borderRadius="$md">
            <Text color="white" fontWeight="$bold">Error</Text>
            <Text color="white">Failed to post ride. Please try again.</Text>
          </Box>
        ),
      });
    }
  };

  const getSafeSeats = () => {
    const parsed = parseInt(seats);
    return isNaN(parsed) ? 1 : parsed;
  };

  return (
    <ScrollView bg="$backgroundLight">
      <Box flex={1} px="$5" py="$6">
        <Heading size="xl" mb="$4" color="white">Post a Ride</Heading>

        <VStack space="lg">
          {/* From */}
          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">From</Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. Berkeley – Unit 1"
                placeholderTextColor="white"
                color="white"
                value={from}
                onChangeText={setFrom}
              />
            </Input>
          </Box>

          {/* To */}
          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">To</Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. SFO Terminal 2"
                placeholderTextColor="white"
                color="white"
                value={to}
                onChangeText={setTo}
              />
            </Input>
          </Box>

          {/* Date */}
          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">Date</Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. June 20"
                placeholderTextColor="white"
                color="white"
                value={date}
                onChangeText={setDate}
              />
            </Input>
          </Box>

          {/* Time */}
          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">Time</Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. 4:00–6:00 PM"
                placeholderTextColor="white"
                color="white"
                value={time}
                onChangeText={setTime}
              />
            </Input>
          </Box>

          {/* Seats */}
          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">
              How many people do you want in the car?
            </Text>

            <HStack alignItems="center" space="md">
              <Button
                variant="outline"
                action="secondary"
                isDisabled={getSafeSeats() <= 1}
                onPress={() =>
                  setSeats(String(Math.max(1, getSafeSeats() - 1)))
                }
              >
                <Text color="white">−</Text>
              </Button>

              <Text color="white" fontSize="$lg" mx="$4">
                {seats}
              </Text>

              <Button
                variant="outline"
                action="secondary"
                isDisabled={getSafeSeats() >= 6}
                onPress={() =>
                  setSeats(String(Math.min(6, getSafeSeats() + 1)))
                }
              >
                <Text color="white">+</Text>
              </Button>
            </HStack>
          </Box>

          {/* Notes */}
          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">Additional Notes</Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="Optional"
                placeholderTextColor="white"
                color="white"
                value={notes}
                onChangeText={setNotes}
              />
            </Input>
          </Box>

          {/* Submit Button */}
          <Button
            mt="$4"
            size="lg"
            action="primary"
            variant="solid"
            borderRadius="$full"
            onPress={handleSubmit}
          >
            <Text color="white">Post Ride</Text>
          </Button>
        </VStack>
      </Box>
    </ScrollView>
  );
}
