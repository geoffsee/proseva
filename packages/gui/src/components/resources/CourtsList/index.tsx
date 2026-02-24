import {
  Box,
  Heading,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { useVirginiaCourts } from "../../../hooks/useVirginiaCourts";

export function CourtsList() {
  const { courts, loading } = useVirginiaCourts();

  if (loading) {
    return <Text>Loading courts...</Text>;
  }

  return (
    <Box>
      <Heading size="lg" mb="4">
        Virginia Courts
      </Heading>
      <VStack align="stretch" gap="3">
        {courts.map((c) => (
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
