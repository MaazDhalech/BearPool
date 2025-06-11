import {
    Avatar,
    Box,
    Button,
    ChevronDownIcon,
    HStack,
    Heading,
    Icon,
    Select,
    SelectBackdrop,
    SelectContent,
    SelectDragIndicator,
    SelectDragIndicatorWrapper,
    SelectIcon,
    SelectInput,
    SelectItem,
    SelectPortal,
    SelectTrigger,
    Text,
    VStack,
} from '@gluestack-ui/themed';
  
  import { useState } from 'react';
  
  export default function ProfileScreen() {
    const [genderPref, setGenderPref] = useState('No Preference');
  
    return (
      <Box flex={1} px="$4" py="$6" bg="$backgroundLight">
        <Heading size="xl" mb="$6" color="white">
          Your Profile
        </Heading>
  
        <VStack space="lg" alignItems="center">
          <Avatar size="2xl" borderRadius="$full" bgColor="$blue500">
            <Text fontSize="$xl" color="white">
              M
            </Text>
          </Avatar>
  
          <VStack space="sm" w="100%" alignItems="flex-start">
            <Text fontSize="$md" color="white">
              Email:
            </Text>
            <Text fontWeight="$semibold" fontSize="$lg" color="white">
              maaz@berkeley.edu
            </Text>
          </VStack>
  
          <HStack space="xl" w="100%" justifyContent="space-between">
            <Box alignItems="center">
              <Text fontSize="$md" color="white">
                Rides Joined
              </Text>
              <Text fontWeight="$bold" fontSize="$lg" color="white">
                3
              </Text>
            </Box>
            <Box alignItems="center">
              <Text fontSize="$md" color="white">
                Rides Hosted
              </Text>
              <Text fontWeight="$bold" fontSize="$lg" color="white">
                1
              </Text>
            </Box>
          </HStack>
  
          <Box w="100%">
            <Text fontSize="$md" color="white" mb="$2">
              Gender Preference
            </Text>
            <Select selectedValue={genderPref} onValueChange={setGenderPref}>
              <SelectTrigger variant="outline" size="md">
                <SelectInput placeholder="Select preference" color="white" />
                <SelectIcon>
                  <Icon as={ChevronDownIcon} color="white" />
                </SelectIcon>
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
                <SelectContent>
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>
                  <SelectItem label="No Preference" value="No Preference" />
                  <SelectItem label="Male Only" value="Male" />
                  <SelectItem label="Female Only" value="Female" />
                  <SelectItem label="Non-binary Only" value="NonBinary" />
                </SelectContent>
              </SelectPortal>
            </Select>
          </Box>
  
          <VStack space="md" mt="$6" w="100%">
            <Button action="secondary" variant="outline">
              <Text color="white">Edit Profile</Text>
            </Button>
            <Button action="negative">
              <Text color="white">Log Out</Text>
            </Button>
          </VStack>
        </VStack>
      </Box>
    );
  }
  