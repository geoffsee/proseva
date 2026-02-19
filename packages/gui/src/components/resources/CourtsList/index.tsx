import {
  Box,
  Heading,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { VIRGINIA_COURTS } from "../../../lib/virginia";

export function CourtsList() {
  return (
    <Box>
      <Heading size="lg" mb="4">
        Virginia Courts
      </Heading>
      <VStack align="stretch" gap="3">
        {VIRGINIA_COURTS.map((c) => (
          <Box key={c.name} borderWidth="1px" p="4" borderRadius="md">
            <Text fontWeight="bold">{c.name}</Text>
            <Text fontSize="sm" color="fg.muted">
              {c.address}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Phone: {c.phone}
            </Text>
            {c.website && (
              <ChakraLink
                href={c.website}
                target="_blank"
                fontSize="sm"
                color="blue.fg"
              >
                Website
              </ChakraLink>
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
