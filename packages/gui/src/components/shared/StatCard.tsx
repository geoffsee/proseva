import { Box, Text } from "@chakra-ui/react";

interface StatCardProps {
  label: string;
  value: string | number;
  helpText?: string;
}

export function StatCard({ label, value, helpText }: StatCardProps) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p="5" minW="180px">
      <Text fontSize="sm" color="fg.muted">
        {label}
      </Text>
      <Text fontSize="3xl" fontWeight="bold" mt="1">
        {value}
      </Text>
      {helpText && (
        <Text fontSize="xs" color="fg.muted" mt="1">
          {helpText}
        </Text>
      )}
    </Box>
  );
}
