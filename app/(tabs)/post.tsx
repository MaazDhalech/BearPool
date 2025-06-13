import {
  Box,
  Button,
  Heading,
  Input,
  InputField,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";

export default function PostScreen() {
  return (
    <ScrollView bg="$backgroundLight">
      <Box flex={1} px="$5" py="$6">
        <Heading size="xl" mb="$4" color="white">
          Post a Ride
        </Heading>

        <VStack space="lg">
          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">
              From
            </Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. Berkeley – Unit 1"
                placeholderTextColor="white"
                color="white"
              />
            </Input>
          </Box>

          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">
              To
            </Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. SFO Terminal 2"
                placeholderTextColor="white"
                color="white"
              />
            </Input>
          </Box>

          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">
              Date
            </Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. June 20"
                placeholderTextColor="white"
                color="white"
              />
            </Input>
          </Box>

          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">
              Time
            </Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. 4:00–6:00 PM"
                placeholderTextColor="white"
                color="white"
              />
            </Input>
          </Box>

          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">
              Seats Available
            </Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="e.g. 3"
                placeholderTextColor="white"
                color="white"
                keyboardType="numeric"
              />
            </Input>
          </Box>

          <Box>
            <Text mb="$1" color="white" fontWeight="$medium">
              Additional Notes
            </Text>
            <Input variant="rounded" size="md">
              <InputField
                placeholder="Optional"
                placeholderTextColor="white"
                color="white"
              />
            </Input>
          </Box>

          <Button
            mt="$4"
            size="lg"
            action="primary"
            variant="solid"
            borderRadius="$full"
          >
            <Text color="white">Post Ride</Text>
          </Button>
        </VStack>
      </Box>
    </ScrollView>
  );
}
