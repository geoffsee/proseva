import { Box, Tabs, Textarea } from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function MarkdownPreview({
  value,
  onChange,
  placeholder,
  rows = 8,
}: MarkdownPreviewProps) {
  return (
    <Tabs.Root defaultValue="edit">
      <Tabs.List>
        <Tabs.Trigger value="edit">Edit</Tabs.Trigger>
        <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="edit" pt="3">
        <Textarea
          value={value}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onChange(e.target.value)
          }
          placeholder={placeholder}
          rows={rows}
        />
      </Tabs.Content>
      <Tabs.Content value="preview" pt="3">
        <Box
          borderWidth="1px"
          borderRadius="md"
          p="3"
          minH={`${rows * 1.5}em`}
          maxH="400px"
          overflowY="auto"
          className="markdown-preview"
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <Box color="fg.muted" fontStyle="italic">
              Nothing to preview
            </Box>
          )}
        </Box>
      </Tabs.Content>
    </Tabs.Root>
  );
}
