import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
  Textarea,
} from "@chakra-ui/react";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";
import type { DocumentTemplate } from "../../../types";

interface TemplateFormProps {
  template: DocumentTemplate;
  fieldValues: Record<string, string>;
  onFieldChange: (name: string, value: string) => void;
  onBack: () => void;
  onPreview: () => void;
}

export function TemplateForm({
  template,
  fieldValues,
  onFieldChange,
  onBack,
  onPreview,
}: TemplateFormProps) {
  const allRequiredFilled = template.fields
    .filter((f) => f.required)
    .every((f) => fieldValues[f.name]?.trim());

  return (
    <VStack align="stretch" gap="6">
      <HStack>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <LuArrowLeft />
        </Button>
        <Heading size="xl" flex="1">
          {template.name}
        </Heading>
      </HStack>
      <VStack align="stretch" gap="4">
        {template.fields.map((field) => (
          <Box key={field.name}>
            <Text fontSize="sm" fontWeight="medium" mb="1">
              {field.label}
              {field.required ? " *" : ""}
            </Text>
            {field.type === "textarea" ? (
              <Textarea
                value={fieldValues[field.name] ?? ""}
                onChange={(e) => onFieldChange(field.name, e.target.value)}
                rows={4}
              />
            ) : field.type === "select" ? (
              <select
                value={fieldValues[field.name] ?? ""}
                onChange={(e) => onFieldChange(field.name, e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--chakra-colors-border)",
                  background: "transparent",
                  color: "inherit",
                }}
              >
                <option value="">Select...</option>
                {field.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={field.type === "date" ? "date" : "text"}
                value={fieldValues[field.name] ?? ""}
                onChange={(e) => onFieldChange(field.name, e.target.value)}
              />
            )}
          </Box>
        ))}
      </VStack>
      <Button onClick={onPreview} disabled={!allRequiredFilled}>
        <LuArrowRight /> Preview Document
      </Button>
    </VStack>
  );
}
