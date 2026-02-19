import { useState } from "react";
import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
  Input,
  Textarea,
  Badge,
} from "@chakra-ui/react";
import { LuArrowLeft, LuArrowRight, LuSave } from "react-icons/lu";
import { ESTATE_DOCUMENT_TEMPLATES } from "../../../lib/virginia/estate-templates";
import type { DocumentTemplate, TemplateField } from "../../../types";

interface Props {
  onSave: (data: {
    type: string;
    title: string;
    content: string;
    fieldValues: Record<string, string>;
    templateId: string;
  }) => void;
  onCancel: () => void;
}

export function EstateDocumentWizard({ onSave, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const handleSelectTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    const initial: Record<string, string> = {};
    for (const field of template.fields) {
      initial[field.name] = "";
    }
    setFieldValues(initial);
    setStep(1);
  };

  const handleFieldChange = (name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const generateContent = (): string => {
    if (!selectedTemplate) return "";
    let content = selectedTemplate.outputFormat;
    for (const [key, value] of Object.entries(fieldValues)) {
      content = content.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        value || `[${key}]`,
      );
    }
    return content;
  };

  const requiredFieldsFilled = selectedTemplate
    ? selectedTemplate.fields
        .filter((f) => f.required)
        .every((f) => fieldValues[f.name]?.trim())
    : false;

  const getDocTypeFromTemplateId = (id: string): string => {
    const mapping: Record<string, string> = {
      "last-will": "last-will",
      "power-of-attorney-financial": "power-of-attorney-financial",
      "advance-medical-directive": "healthcare-directive",
      "revocable-living-trust": "trust",
    };
    return mapping[id] ?? "other";
  };

  const handleSave = () => {
    if (!selectedTemplate) return;
    onSave({
      type: getDocTypeFromTemplateId(selectedTemplate.id),
      title: selectedTemplate.name,
      content: generateContent(),
      fieldValues,
      templateId: selectedTemplate.id,
    });
  };

  return (
    <Box>
      <HStack mb="6" justifyContent="space-between">
        <HStack gap="3">
          <Button
            variant="outline"
            size="sm"
            onClick={step === 0 ? onCancel : () => setStep(step - 1)}
          >
            <LuArrowLeft /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          <Text fontWeight="bold" fontSize="lg">
            Draft Estate Document
          </Text>
        </HStack>
        <HStack gap="2">
          {[0, 1, 2].map((s) => (
            <Badge
              key={s}
              colorPalette={step === s ? "blue" : step > s ? "green" : "gray"}
              size="sm"
            >
              {s === 0
                ? "Select Template"
                : s === 1
                  ? "Fill Fields"
                  : "Preview"}
            </Badge>
          ))}
        </HStack>
      </HStack>

      {/* Step 0: Select Template */}
      {step === 0 && (
        <VStack align="stretch" gap="3">
          <Text fontSize="md" color="fg.muted" mb="2">
            Choose a Virginia-compliant estate document template:
          </Text>
          {ESTATE_DOCUMENT_TEMPLATES.map((template) => (
            <Box
              key={template.id}
              borderWidth="1px"
              borderRadius="md"
              p="4"
              cursor="pointer"
              _hover={{ bg: "bg.muted" }}
              onClick={() => handleSelectTemplate(template)}
            >
              <Text fontWeight="semibold">{template.name}</Text>
              {template.description && (
                <Text fontSize="sm" color="fg.muted" mt="1">
                  {template.description}
                </Text>
              )}
            </Box>
          ))}
        </VStack>
      )}

      {/* Step 1: Fill Fields */}
      {step === 1 && selectedTemplate && (
        <VStack align="stretch" gap="4">
          <Text fontSize="md" color="fg.muted" mb="2">
            Fill in the required information for:{" "}
            <strong>{selectedTemplate.name}</strong>
          </Text>
          {selectedTemplate.fields.map((field: TemplateField) => (
            <Box key={field.name}>
              <Text fontWeight="medium" mb="1">
                {field.label} {field.required && "*"}
              </Text>
              {field.type === "textarea" ? (
                <Textarea
                  value={fieldValues[field.name] ?? ""}
                  onChange={(e) =>
                    handleFieldChange(field.name, e.target.value)
                  }
                  rows={4}
                />
              ) : field.type === "select" && field.options ? (
                <select
                  value={fieldValues[field.name] ?? ""}
                  onChange={(e) =>
                    handleFieldChange(field.name, e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <option value="">Select...</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type={field.type === "date" ? "date" : "text"}
                  value={fieldValues[field.name] ?? ""}
                  onChange={(e) =>
                    handleFieldChange(field.name, e.target.value)
                  }
                />
              )}
            </Box>
          ))}
          <HStack justifyContent="flex-end" mt="4">
            <Button onClick={() => setStep(2)} disabled={!requiredFieldsFilled}>
              Preview <LuArrowRight />
            </Button>
          </HStack>
        </VStack>
      )}

      {/* Step 2: Preview */}
      {step === 2 && selectedTemplate && (
        <VStack align="stretch" gap="4">
          <Text fontSize="md" color="fg.muted" mb="2">
            Preview your generated document. Review carefully before saving.
          </Text>
          <Box
            borderWidth="1px"
            borderRadius="md"
            p="6"
            bg="bg.subtle"
            whiteSpace="pre-wrap"
            fontFamily="serif"
            fontSize="sm"
            lineHeight="tall"
            maxH="500px"
            overflowY="auto"
          >
            {generateContent()}
          </Box>
          <HStack justifyContent="flex-end" mt="4" gap="3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <LuArrowLeft /> Edit Fields
            </Button>
            <Button onClick={handleSave}>
              <LuSave /> Save Document
            </Button>
          </HStack>
        </VStack>
      )}
    </Box>
  );
}
