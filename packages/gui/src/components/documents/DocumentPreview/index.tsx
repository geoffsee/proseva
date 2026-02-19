import { Box, Button, Heading, HStack, VStack } from "@chakra-ui/react";
import { LuPrinter, LuCopy, LuArrowLeft } from "react-icons/lu";

interface DocumentPreviewProps {
  name: string;
  content: string;
  onBack: () => void;
}

export function DocumentPreview({
  name,
  content,
  onBack,
}: DocumentPreviewProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(
        `<pre style="white-space:pre-wrap;font-family:monospace;max-width:800px;margin:40px auto;">${content}</pre>`,
      );
      w.document.close();
      w.print();
    }
  };

  return (
    <VStack align="stretch" gap="6">
      <HStack>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <LuArrowLeft />
        </Button>
        <Heading size="xl" flex="1">
          Preview: {name}
        </Heading>
      </HStack>
      <HStack gap="2">
        <Button size="sm" onClick={handleCopy}>
          <LuCopy /> Copy
        </Button>
        <Button size="sm" onClick={handlePrint}>
          <LuPrinter /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={onBack}>
          <LuArrowLeft /> Edit
        </Button>
      </HStack>
      <Box
        borderWidth="1px"
        borderRadius="md"
        p="6"
        whiteSpace="pre-wrap"
        fontFamily="mono"
        fontSize="sm"
      >
        {content}
      </Box>
    </VStack>
  );
}
