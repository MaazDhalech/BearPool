import {
  Avatar,
  Box,
  HStack,
  Heading,
  Pressable,
  ScrollView,
  Text,
  VStack
} from '@gluestack-ui/themed';
  
  const chatGroups = [
    {
      id: '1',
      title: 'Group to SFO T2',
      preview: 'We’re meeting outside I-House at 3:30.',
      timestamp: '2h ago',
      members: ['JD', 'MS', 'AK'],
    },
    {
      id: '2',
      title: 'Return from OAK',
      preview: 'Ride is at 6PM – we’ll split 4 ways.',
      timestamp: 'Yesterday',
      members: ['LD', 'MP'],
    },
  ];
  
  export default function ChatsScreen() {
    return (
      <ScrollView bg="$backgroundLight">
        <Box px="$4" py="$6">
          <Heading size="xl" mb="$4" color="$textDark">
            Your Ride Groups
          </Heading>
  
          <VStack space="lg">
            {chatGroups.map((group) => (
              <Pressable key={group.id} borderRadius="$lg" bg="$white" p="$4">
                <VStack space="xs">
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="$bold" fontSize="$md" color="$textDark">
                      {group.title}
                    </Text>
                    <Text fontSize="$xs" color="$coolGray500">
                      {group.timestamp}
                    </Text>
                  </HStack>
  
                  <Text color="$coolGray600" numberOfLines={1}>
                    {group.preview}
                  </Text>
  
                  <HStack space="sm" mt="$2">
                    {group.members.map((initials, index) => (
                      <Avatar key={index} size="sm">
                        <Text>{initials}</Text>
                      </Avatar>
                    ))}
                  </HStack>
                </VStack>
              </Pressable>
            ))}
          </VStack>
        </Box>
      </ScrollView>
    );
  }
  