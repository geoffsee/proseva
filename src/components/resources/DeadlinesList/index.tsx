import { Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { FILING_DEADLINES } from "../../../lib/virginia";

export function DeadlinesList() {
  return (
    <Box>
      <Heading size="lg" mb="4">
        Common Filing Deadlines
      </Heading>
      <VStack align="stretch" gap="3">
        {FILING_DEADLINES.map((d) => (
          <HStack
            key={d.name}
            borderWidth="1px"
            p="4"
            borderRadius="md"
            justifyContent="space-between"
          >
            <Box>
              <Text fontWeight="bold">{d.name}</Text>
              <Text fontSize="sm" color="fg.muted">
                {d.description}
              </Text>
            </Box>
            <Text fontWeight="bold" fontSize="lg" color="orange.fg">
              {d.days} days
            </Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
