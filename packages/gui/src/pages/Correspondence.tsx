import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuMail, LuUpload } from "react-icons/lu";
import {
  api,
  type Case,
  type Correspondence as CorrespondenceRecord,
  type CorrespondenceEmailImportResult,
  type EmailServiceStatus,
} from "../lib/api";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString();
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Correspondence() {
  const [items, setItems] = useState<CorrespondenceRecord[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] =
    useState<CorrespondenceEmailImportResult | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [emailStatus, setEmailStatus] = useState<EmailServiceStatus | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void api.email
      .status()
      .then(setEmailStatus)
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [correspondence, caseList] = await Promise.all([
        api.correspondence.list(),
        api.cases.list(),
      ]);
      setItems(
        [...correspondence].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      );
      setCases(caseList ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load correspondence",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const caseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of cases) {
      map.set(item.id, item.name);
    }
    return map;
  }, [cases]);

  const incomingCount = useMemo(
    () => items.filter((item) => item.direction === "incoming").length,
    [items],
  );
  const outgoingCount = useMemo(
    () => items.filter((item) => item.direction === "outgoing").length,
    [items],
  );

  const handleImport = async () => {
    if (files.length === 0) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      if (selectedCaseId) {
        formData.append("caseId", selectedCaseId);
      }

      const result = await api.correspondence.importEmails(formData);
      setImportResult(result);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Email import failed",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleAttachmentDownload = async (
    correspondenceId: string,
    attachmentId: string,
  ) => {
    setDownloadError("");
    setDownloadingAttachmentId(attachmentId);
    try {
      const { blob, filename } = await api.correspondence.downloadAttachment(
        correspondenceId,
        attachmentId,
      );
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename || "attachment.bin";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Failed to download attachment",
      );
    } finally {
      setDownloadingAttachmentId((current) =>
        current === attachmentId ? null : current,
      );
    }
  };

  if (loading) {
    return <Text p="8">Loading correspondence…</Text>;
  }

  if (loadError) {
    return (
      <Text p="8" color="red.500">
        Error: {loadError}
      </Text>
    );
  }

  return (
    <VStack align="stretch" gap="6">
      <Heading size="2xl">Correspondence</Heading>
      <Text color="fg.muted">
        Import `.eml` files to track incoming and outgoing email communication.
      </Text>

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Total" value={items.length.toString()} />
        <StatCard label="Incoming" value={incomingCount.toString()} />
        <StatCard label="Outgoing" value={outgoingCount.toString()} />
        {emailStatus?.configured && (
          <Badge colorPalette="blue" variant="subtle" px={3} py={1}>
            <LuMail style={{ display: "inline", marginRight: 4 }} />
            {emailStatus.emailAddress}
          </Badge>
        )}
      </HStack>

      <Box borderWidth="1px" borderRadius="lg" p="5">
        <VStack align="stretch" gap="4">
          <Heading size="md">Import Emails</Heading>

          <Input
            ref={fileInputRef}
            type="file"
            accept=".eml,message/rfc822"
            multiple
            onChange={(event) => {
              const selected = event.currentTarget.files
                ? Array.from(event.currentTarget.files)
                : [];
              setFiles(selected);
              setImportResult(null);
              setImportError("");
            }}
          />

          <HStack gap="3" flexWrap="wrap">
            <Text fontSize="sm" color="fg.muted">
              Assign case (optional):
            </Text>
            <select
              style={{
                minWidth: "220px",
                padding: "8px 12px",
                borderWidth: "1px",
                borderRadius: "6px",
              }}
              value={selectedCaseId}
              onChange={(event) => setSelectedCaseId(event.target.value)}
            >
              <option value="">No Case</option>
              {cases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </HStack>

          <HStack gap="3" flexWrap="wrap">
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || files.length === 0}
            >
              <LuUpload /> {importing ? "Importing…" : "Import Emails"}
            </Button>
            <Text fontSize="sm" color="fg.muted">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </Text>
          </HStack>

          {importError && (
            <Text color="red.500" fontSize="sm">
              {importError}
            </Text>
          )}

          {importResult && (
            <VStack align="stretch" gap="1">
              <Text color="green.600" fontSize="sm">
                Imported {importResult.createdCount} email
                {importResult.createdCount === 1 ? "" : "s"}.
              </Text>
              {importResult.errorCount > 0 && (
                <Text color="orange.500" fontSize="sm">
                  {importResult.errorCount} file
                  {importResult.errorCount === 1 ? "" : "s"} failed.
                </Text>
              )}
            </VStack>
          )}
        </VStack>
      </Box>

      {items.length === 0 ? (
        <EmptyState
          icon={LuMail}
          title="No correspondence yet"
          description="Import `.eml` files above to start tracking communication."
        />
      ) : (
        <Box overflowX="auto">
          {downloadError && (
            <Text color="red.500" fontSize="sm" mb="3">
              {downloadError}
            </Text>
          )}
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Date</Table.ColumnHeader>
                <Table.ColumnHeader>Direction</Table.ColumnHeader>
                <Table.ColumnHeader>Subject</Table.ColumnHeader>
                <Table.ColumnHeader>From</Table.ColumnHeader>
                <Table.ColumnHeader>To</Table.ColumnHeader>
                <Table.ColumnHeader>Case</Table.ColumnHeader>
                <Table.ColumnHeader>Attachments</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>{formatDate(item.date)}</Table.Cell>
                  <Table.Cell>
                    <Badge
                      colorScheme={
                        item.direction === "incoming" ? "green" : "blue"
                      }
                    >
                      {item.direction}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell maxW="340px">
                    <Text fontWeight="medium" truncate>
                      {item.subject || "(No subject)"}
                    </Text>
                    {item.summary && (
                      <Text fontSize="xs" color="fg.muted" truncate>
                        {item.summary}
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell maxW="220px">
                    <Text truncate>{item.sender || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell maxW="220px">
                    <Text truncate>{item.recipient || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {item.caseId
                      ? caseNameById.get(item.caseId) || item.caseId
                      : "—"}
                  </Table.Cell>
                  <Table.Cell maxW="320px">
                    {(item.attachments ?? []).length === 0 ? (
                      <Text color="fg.muted">—</Text>
                    ) : (
                      <VStack align="stretch" gap="1">
                        {(item.attachments ?? []).map((attachment) => (
                          <Button
                            key={attachment.id}
                            size="xs"
                            variant="outline"
                            justifyContent="flex-start"
                            onClick={() =>
                              void handleAttachmentDownload(
                                item.id,
                                attachment.id,
                              )
                            }
                            loading={downloadingAttachmentId === attachment.id}
                          >
                            {attachment.filename} (
                            {formatBytes(attachment.size)})
                          </Button>
                        ))}
                      </VStack>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </VStack>
  );
}
