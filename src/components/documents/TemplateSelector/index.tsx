import { useMemo } from "react";
import { Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { LuFileText } from "react-icons/lu";
import { DOCUMENT_TEMPLATES } from "../../../lib/virginia";
import { EmptyState } from "../../shared/EmptyState";
import type { DocumentTemplate } from "../../../types";

interface TemplateSelectorProps {
  onSelect: (template: DocumentTemplate) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const categories = useMemo(() => {
    const cats = new Map<string, DocumentTemplate[]>();
    for (const t of DOCUMENT_TEMPLATES) {
      const list = cats.get(t.category) ?? [];
      list.push(t);
      cats.set(t.category, list);
    }
    return cats;
  }, []);

  return (
    <VStack align="stretch" gap="6">
      <Heading size="2xl">Document Generator</Heading>
      <Text color="fg.muted">
        Select a template to generate a Virginia court document.
      </Text>
      {DOCUMENT_TEMPLATES.length === 0 ? (
        <EmptyState icon={LuFileText} title="No templates available" />
      ) : (
        Array.from(categories.entries()).map(([cat, templates]) => (
          <Box key={cat}>
            <Heading size="md" mb="3">
              {cat}
            </Heading>
            <VStack align="stretch" gap="2">
              {templates.map((t) => (
                <HStack
                  key={t.id}
                  borderWidth="1px"
                  p="4"
                  borderRadius="md"
                  cursor="pointer"
                  _hover={{ bg: "bg.muted" }}
                  onClick={() => onSelect(t)}
                  justifyContent="space-between"
                >
                  <Text fontWeight="medium">{t.name}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {t.fields.length} fields
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Box>
        ))
      )}
    </VStack>
  );
}
