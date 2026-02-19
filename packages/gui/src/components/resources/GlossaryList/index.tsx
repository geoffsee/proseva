import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import { LEGAL_GLOSSARY } from "../../../lib/virginia";

export function GlossaryList() {
  return (
    <Box>
      <Heading size="lg" mb="4">
        Legal Glossary
      </Heading>
      <VStack align="stretch" gap="2">
        {LEGAL_GLOSSARY.map((g) => (
          <Box key={g.term} borderWidth="1px" p="3" borderRadius="md">
            <Text fontWeight="bold" fontSize="sm">
              {g.term}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {g.definition}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
