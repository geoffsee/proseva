import React, { useState, useRef, useCallback } from "react";
import { Box, VStack, HStack, Text, Button } from "@chakra-ui/react";
import { LuUpload, LuX, LuFile } from "react-icons/lu";
import { api } from "../lib/api";

const DEFAULT_CATEGORIES = [
  "Motions",
  "Orders",
  "Pleadings",
  "Discovery",
  "Correspondence",
  "Financial Records",
  "Evidence",
  "Agreements",
  "Court Documents",
  "Medical Records",
  "Personal Documents",
  "Other",
];

interface FileUploadProps {
  categories?: string[];
  onUploadComplete?: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  categories = [],
  onUploadComplete,
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const allCategories = React.useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...categories]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories]);
  const [category, setCategory] = useState("_new_filings");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length === 0) {
      setError("Only PDF files are accepted.");
      return;
    }
    setError("");
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !names.has(f.name))];
    });
  }, []);

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("category", category);

    try {
      await api.documents.upload(formData);
      setFiles([]);
      onUploadComplete?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Box
      borderWidth="2px"
      borderStyle="dashed"
      borderColor={dragOver ? "blue.400" : "border.muted"}
      borderRadius="lg"
      p="6"
      bg={dragOver ? "blue.50" : "bg.subtle"}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      transition="all 0.2s"
      data-testid="drop-zone"
    >
      <VStack gap="4" align="stretch">
        <HStack justify="center" gap="2" color="fg.muted">
          <LuUpload />
          <Text>Drag & drop PDF files here, or</Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            Browse Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            hidden
            onChange={handleFileInput}
            data-testid="file-input"
          />
        </HStack>

        {files.length > 0 && (
          <VStack align="stretch" gap="2">
            {files.map((f) => (
              <HStack
                key={f.name}
                justify="space-between"
                px="3"
                py="1"
                bg="bg.muted"
                borderRadius="md"
              >
                <HStack gap="2">
                  <LuFile />
                  <Text fontSize="sm">{f.name}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    ({formatSize(f.size)})
                  </Text>
                </HStack>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => removeFile(f.name)}
                  aria-label={`Remove ${f.name}`}
                >
                  <LuX />
                </Button>
              </HStack>
            ))}
          </VStack>
        )}

        {files.length > 0 && (
          <HStack gap="4" flexWrap="wrap">
            <select
              style={{
                padding: "8px 12px",
                borderWidth: "1px",
                borderRadius: "6px",
              }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-testid="category-select"
            >
              <option value="_new_filings">New Filings (Unsorted)</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button
              colorPalette="blue"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading
                ? "Uploading…"
                : `Upload ${files.length} file${files.length !== 1 ? "s" : ""}`}
            </Button>
          </HStack>
        )}

        {error && (
          <Text color="red.500" fontSize="sm" data-testid="upload-error">
            {error}
          </Text>
        )}
      </VStack>
    </Box>
  );
}
