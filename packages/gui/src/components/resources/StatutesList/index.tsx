import {
  Box,
  Heading,
  HStack,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { VIRGINIA_STATUTES } from "../../../lib/virginia";

export function StatutesList() {
  return (
    <Box>
      <Heading size="lg" mb="4">
        Key Virginia Statutes
      </Heading>
      <VStack align="stretch" gap="3">
        {VIRGINIA_STATUTES.map((s) => (
          <Box key={s.code} borderWidth="1px" p="4" borderRadius="md">
            <HStack justifyContent="space-between" flexWrap="wrap">
              <Text fontWeight="bold">{s.code}</Text>
              <ChakraLink
                href={s.url}
                target="_blank"
                fontSize="sm"
                color="blue.fg"
              >
                View Full Text
              </ChakraLink>
            </HStack>
            <Text fontWeight="medium" fontSize="sm">
              {s.title}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {s.description}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
