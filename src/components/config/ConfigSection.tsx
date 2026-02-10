import { useState } from "react";
import type { ReactNode } from "react";
import {
  Card,
  VStack,
  HStack,
  Heading,
  Badge,
  Button,
  Separator,
} from "@chakra-ui/react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

interface ConfigSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  status?: "database" | "environment";
  testConnection?: () => Promise<void>;
  clearOverrides?: () => Promise<void>;
  isTesting?: boolean;
}

export function ConfigSection({
  title,
  icon,
  children,
  status,
  testConnection,
  clearOverrides,
  isTesting,
}: ConfigSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between">
          <HStack>
            {icon}
            <Heading size="md">{title}</Heading>
            {status && (
              <Badge colorPalette={status === "database" ? "green" : "gray"}>
                {status === "database"
                  ? "Database Config"
                  : "Environment Variable"}
              </Badge>
            )}
          </HStack>
          <HStack>
            {testConnection && (
              <Button
                size="sm"
                variant="outline"
                onClick={testConnection}
                loading={isTesting}
              >
                Test Connection
              </Button>
            )}
            {clearOverrides && (
              <Button size="sm" variant="ghost" onClick={clearOverrides}>
                Clear Overrides
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
            </Button>
          </HStack>
        </HStack>
      </Card.Header>
      {isExpanded && (
        <>
          <Separator />
          <Card.Body>
            <VStack gap={4} align="stretch">
              {children}
            </VStack>
          </Card.Body>
        </>
      )}
    </Card.Root>
  );
}
