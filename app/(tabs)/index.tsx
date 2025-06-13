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
} from "@gluestack-ui/themed";

import { useState } from "react";

const fakePins = [
  {
    id: "1",
    from: "Berkeley – Unit 1",
    to: "SFO Terminal 2",
    date: "June 20",
    time: "4:00–6:00 PM",
    users: 2,
  },
  {
    id: "2",
    from: "SFO Terminal 3",
    to: "Berkeley – I-House",
    date: "June 22",
    time: "1:00–2:30 PM",
    users: 1,
  },
];

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPins = fakePins.filter((pin) => {
    const query = searchQuery.toLowerCase();
    return (
      pin.from.toLowerCase().includes(query) ||
      pin.to.toLowerCase().includes(query)
    );
  });

  return (
    <ScrollView px="$4" py="$6" bg="$backgroundLight">
      <Heading size="xl" mb="$4" color="$textDark">
        Upcoming Ride Groups
      </Heading>

      <Input mb="$6" size="md" variant="outline">
        <InputField
          placeholder="Search by location or destination..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </Input>

      <VStack space="lg">
        {filteredPins.map((pin) => (
          <Box
            key={pin.id}
            p="$4"
            borderRadius="$lg"
            borderWidth="$1"
            borderColor="$coolGray300"
            bg="$backgroundLight0"
          >
            <VStack space="xs">
              <Text fontWeight="$bold" fontSize="$md">
                {pin.from} → {pin.to}
              </Text>
              <Text color="$coolGray500">
                {pin.date}, {pin.time}
              </Text>
              <Text color="$coolGray500">{pin.users} joined</Text>
            </VStack>

            <HStack justifyContent="flex-end" mt="$4">
              <Button size="sm" action="primary" variant="solid">
                Join
              </Button>
            </HStack>
          </Box>
        ))}

        {filteredPins.length === 0 && (
          <Text color="$coolGray500" textAlign="center" mt="$6">
            No ride groups found.
          </Text>
        )}
      </VStack>
    </ScrollView>
  );
}
