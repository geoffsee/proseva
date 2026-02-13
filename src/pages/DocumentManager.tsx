import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  VStack,
  Text,
  Input,
  Table,
  Badge,
} from "@chakra-ui/react";
import { LuChevronDown, LuChevronRight, LuTrash2 } from "react-icons/lu";
import { StatCard } from "../components/shared/StatCard";
import FileUpload from "../components/FileUpload";
import { getAuthToken, API_BASE } from "../lib/api";
import { useStore } from "../store/StoreContext";

interface DocumentEntry {
  id: string;
  filename: string;
  path: string;
  category: string;
  title: string;
  pageCount: number;
  textFile: string;
  dates: string[];
  fileSize: number;
  caseId?: string;
}

export default function DocumentManager() {
  const store = useStore();
  const [docs, setDocs] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ingestStatus, setIngestStatus] = useState<{
    active: boolean;
    directory: string;
    running: boolean;
    lastRunStarted: string | null;
    lastRunFinished: string | null;
    added: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedText, setExpandedText] = useState<Record<string, string>>({});
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const token = await getAuthToken();
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    fetch(`${API_BASE}/documents`, { headers })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load: ${r.status}`);
        return r.json();
      })
      .then((data: DocumentEntry[]) => setDocs(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    const loadStatus = async () => {
      const token = await getAuthToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      return fetch(`${API_BASE}/ingest/status`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
        .then((data) => setIngestStatus(data))
        .catch(() =>
          setIngestStatus(
            (prev) =>
              prev ?? {
                active: false,
                directory: "",
                running: false,
                lastRunStarted: null,
                lastRunFinished: null,
                added: 0,
                skipped: 0,
                errors: 0,
              },
          ),
        );
    };
    loadStatus();
    const timer = setInterval(loadStatus, 10000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  function handleRowClick(doc: DocumentEntry) {
    if (expandedId === doc.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(doc.id);
    if (!expandedText[doc.id] && doc.textFile) {
      setLoadingText(doc.id);
      getAuthToken()
        .then((token) => {
          const headers: HeadersInit = token
            ? { Authorization: `Bearer ${token}` }
            : {};
          return fetch(`/texts/${doc.id}.txt`, { headers });
        })
        .then((r) => (r.ok ? r.text() : Promise.resolve("")))
        .then((text) =>
          setExpandedText((prev) => ({ ...prev, [doc.id]: text })),
        )
        .finally(() => setLoadingText(null));
    }
  }

  async function handleDelete(doc: DocumentEntry) {
    if (!confirm(`Delete "${doc.title || doc.filename}"?`)) return;
    setDeleteError("");
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(`${API_BASE}/documents/${doc.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const categories = useMemo(
    () => [...new Set(docs.map((d) => d.category))].sort(),
    [docs],
  );

  const filtered = useMemo(() => {
    let result = docs;
    if (categoryFilter)
      result = result.filter((d) => d.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }
    return result;
  }, [docs, categoryFilter, search]);

  const totalPages = useMemo(
    () => docs.reduce((s, d) => s + d.pageCount, 0),
    [docs],
  );

  const duplicateInfo = useMemo(() => {
    const groups: Record<string, DocumentEntry[]> = {};
    for (const d of docs) {
      const key = `${(d.title || d.filename).toLowerCase().trim()}|${d.pageCount}|${d.fileSize}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    const duplicateIds = new Set<string>();
    const duplicateGroups = Object.values(groups).filter((g) => g.length > 1);
    duplicateGroups.forEach((g) =>
      g.forEach((doc) => duplicateIds.add(doc.id)),
    );
    return { duplicateIds, duplicateGroupsCount: duplicateGroups.length };
  }, [docs]);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) return <Text p="8">Loading documents…</Text>;
  if (error)
    return (
      <Text p="8" color="red.500">
        Error: {error}
      </Text>
    );

  return (
    <VStack align="stretch" gap="8">
      <Heading size="2xl">Document Manager</Heading>
      {ingestStatus ? (
        <Box p="3" borderWidth="1px" borderRadius="md" bg="bg.subtle">
          <HStack gap="3" flexWrap="wrap">
            <Badge
              colorScheme={
                ingestStatus.running
                  ? "yellow"
                  : ingestStatus.active
                    ? "green"
                    : "gray"
              }
            >
              Auto-ingest{" "}
              {ingestStatus.running
                ? "Running"
                : ingestStatus.active
                  ? "Idle"
                  : "Disabled"}
            </Badge>
            <Text fontSize="sm">
              Directory: {ingestStatus.directory || "not set"}
            </Text>
            <Text fontSize="sm">Added: {ingestStatus.added}</Text>
            <Text fontSize="sm">Skipped: {ingestStatus.skipped}</Text>
            <Text fontSize="sm">Errors: {ingestStatus.errors}</Text>
            <Text fontSize="sm">
              Last run:{" "}
              {ingestStatus.lastRunFinished ||
                ingestStatus.lastRunStarted ||
                "—"}
            </Text>
          </HStack>
        </Box>
      ) : null}

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Total Documents" value={docs.length} />
        <StatCard label="Categories" value={categories.length} />
        <StatCard label="Total Pages" value={totalPages} />
        <StatCard label="Duplicates" value={duplicateInfo.duplicateIds.size} />
      </HStack>

      <FileUpload
        categories={categories}
        onUploadComplete={() => {
          fetchDocs();
          // Reload stores so Timeline and other pages reflect
          // cases/filings/evidence/deadlines created during ingestion
          store.caseStore.loadCases();
          store.filingStore.loadFilings();
          store.evidenceStore.loadEvidences();
          store.deadlineStore.loadDeadlines();
          store.contactStore.loadContacts();
          store.noteStore.loadNotes();
        }}
      />

      <HStack gap="4" flexWrap="wrap">
        <Input
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxW="400px"
        />
        <select
          style={{
            maxWidth: "250px",
            padding: "8px 12px",
            borderWidth: "1px",
            borderRadius: "6px",
          }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </HStack>

      <Text fontSize="sm" color="fg.muted">
        {filtered.length} document{filtered.length !== 1 ? "s" : ""}
      </Text>

      {deleteError && (
        <Text color="red.500" fontSize="sm">
          {deleteError}
        </Text>
      )}

      <Box overflowX="auto">
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader w="30px" />
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              <Table.ColumnHeader>Category</Table.ColumnHeader>
              <Table.ColumnHeader>Pages</Table.ColumnHeader>
              <Table.ColumnHeader>Dates</Table.ColumnHeader>
              <Table.ColumnHeader>Size</Table.ColumnHeader>
              <Table.ColumnHeader>Case</Table.ColumnHeader>
              <Table.ColumnHeader w="50px" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((doc) => (
              <React.Fragment key={doc.id}>
                <Table.Row
                  cursor="pointer"
                  onClick={() => handleRowClick(doc)}
                  _hover={{ bg: "bg.muted" }}
                >
                  <Table.Cell>
                    {expandedId === doc.id ? (
                      <LuChevronDown />
                    ) : (
                      <LuChevronRight />
                    )}
                  </Table.Cell>
                  <Table.Cell fontWeight="medium">
                    {doc.title || doc.filename}
                    {duplicateInfo.duplicateIds.has(doc.id) && (
                      <Badge colorScheme="red" ml="2">
                        Duplicate
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge>{doc.category}</Badge>
                  </Table.Cell>
                  <Table.Cell>{doc.pageCount}</Table.Cell>
                  <Table.Cell>
                    {doc.dates.length > 0
                      ? doc.dates.slice(0, 3).join(", ")
                      : "—"}
                    {doc.dates.length > 3 && ` +${doc.dates.length - 3}`}
                  </Table.Cell>
                  <Table.Cell>{formatSize(doc.fileSize)}</Table.Cell>
                  <Table.Cell>
                    {doc.caseId ? (
                      <a
                        href={`/cases/${doc.caseId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: "var(--chakra-colors-blue-500)",
                          textDecoration: "underline",
                        }}
                      >
                        {doc.caseId}
                      </a>
                    ) : (
                      "—"
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorPalette="red"
                      aria-label={`Delete ${doc.title || doc.filename}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc);
                      }}
                    >
                      <LuTrash2 />
                    </Button>
                  </Table.Cell>
                </Table.Row>
                {expandedId === doc.id && (
                  <Table.Row>
                    <Table.Cell colSpan={8}>
                      <Box
                        p="4"
                        bg="bg.subtle"
                        borderRadius="md"
                        maxH="300px"
                        overflowY="auto"
                      >
                        <Text fontSize="xs" color="fg.muted" mb="1">
                          File: {doc.path}
                        </Text>
                        {loadingText === doc.id ? (
                          <Text fontSize="sm" color="fg.muted">
                            Loading text…
                          </Text>
                        ) : (
                          <Text fontSize="sm" whiteSpace="pre-wrap">
                            {expandedText[doc.id] ||
                              "No extracted text available."}
                          </Text>
                        )}
                      </Box>
                    </Table.Cell>
                  </Table.Row>
                )}
              </React.Fragment>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {filtered.length === 0 && (
        <Text color="fg.muted" textAlign="center" py="8">
          {docs.length === 0
            ? "No documents indexed yet. Run the ingest script first."
            : "No documents match your filters."}
        </Text>
      )}
    </VStack>
  );
}
