import { VStack, Text, Icon } from "@chakra-ui/react";
import type { IconType } from "react-icons";

interface EmptyStateProps {
  icon: IconType;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <VStack py="16" gap="4" opacity="0.6">
      <Icon fontSize="4xl">
        <>{icon({})}</>
      </Icon>
      <Text fontWeight="bold" fontSize="lg">
        {title}
      </Text>
      {description && (
        <Text fontSize="sm" maxW="sm" textAlign="center">
          {description}
        </Text>
      )}
      {children}
    </VStack>
  );
}
