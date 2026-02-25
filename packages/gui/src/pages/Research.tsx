import {
  Box,
  Heading,
  HStack,
  VStack,
  Text,
  Input,
  IconButton,
  Icon,
  Button,
} from "@chakra-ui/react";
import {
  LuSend,
  LuBot,
  LuUser,
  LuPanelRightOpen,
  LuPanelRightClose,
  LuTrash2,
  LuExternalLink,
  LuBookOpen,
  LuScale,
  LuFileText,
  LuGraduationCap,
  LuBuilding,
  LuGavel,
  LuUsers,
  LuStickyNote,
} from "react-icons/lu";
import { useState, useRef, useEffect, type ElementType } from "react";
import { observer } from "mobx-react-lite";
import Markdown from "react-markdown";
import { useStore } from "../store/StoreContext";
import { useActivityStatus } from "../hooks/useActivityStatus";
import AddEditNoteDialog from "../components/notes/AddEditNoteDialog";
import type { Note } from "../types";

interface ResultItem {
  id?: string | number;
  caseName?: string;
  title?: string;
  name?: string;
  citation?: string;
  court?: string;
  dateFiled?: string;
  dateIssued?: string;
  year?: string;
  lastActionDate?: string;
  authors?: string;
  journal?: string;
  snippet?: string;
  phone?: string;
  citedBy?: number;
  absoluteUrl?: string;
  url?: string;
  detailsLink?: string;
  link?: string;
  website?: string;
}

interface ResultSet {
  toolName: string;
  results: unknown;
}

const TOOL_LABELS: Record<string, { label: string; icon: ElementType }> = {
  search_opinions: { label: "Court Opinions", icon: LuGavel },
  search_dockets: { label: "Dockets", icon: LuScale },
  lookup_citation: { label: "Citation Lookup", icon: LuBookOpen },
  search_statutes: { label: "Statutes", icon: LuFileText },
  search_govinfo: { label: "Gov Documents", icon: LuBuilding },
  search_academic: { label: "Academic Papers", icon: LuGraduationCap },
  search_lawyers: { label: "Lawyers", icon: LuUsers },
};

const QUICK_ACTIONS = [
  { label: "Search Opinions", prompt: "Search for court opinions about " },
  { label: "Search Statutes", prompt: "Find statutes related to " },
  { label: "Lookup Citation", prompt: "Look up the citation " },
  { label: "Find Lawyers", prompt: "Find lawyers in " },
];

function ResultCard({
  item,
  toolName,
}: {
  item: ResultItem;
  toolName: string;
}) {
  const link =
    item.absoluteUrl ||
    item.url ||
    item.detailsLink ||
    item.link ||
    item.website ||
    "";
  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      p="3"
      fontSize="xs"
      _hover={{ bg: "bg.muted" }}
    >
      <Text fontWeight="semibold" lineClamp={2}>
        {item.caseName || item.title || item.name || "Untitled"}
      </Text>
      {item.citation && (
        <Text color="fg.muted" mt="1">
          {item.citation}
        </Text>
      )}
      {item.court && <Text color="fg.muted">{item.court}</Text>}
      {(item.dateFiled ||
        item.dateIssued ||
        item.year ||
        item.lastActionDate) && (
        <Text color="fg.muted">
          {item.dateFiled ||
            item.dateIssued ||
            item.year ||
            item.lastActionDate}
        </Text>
      )}
      {item.authors && (
        <Text color="fg.muted" lineClamp={1}>
          {item.authors}
        </Text>
      )}
      {item.journal && (
        <Text color="fg.muted" lineClamp={1}>
          {item.journal}
        </Text>
      )}
      {item.snippet && (
        <Text color="fg.muted" mt="1" lineClamp={2}>
          {item.snippet.replace(/<[^>]*>/g, "")}
        </Text>
      )}
      {toolName === "search_lawyers" && item.phone && (
        <Text color="fg.muted">{item.phone}</Text>
      )}
      {(item.citedBy ?? 0) > 0 && (
        <Text color="fg.muted">Cited by {item.citedBy}</Text>
      )}
      {link && (
        <HStack mt="1">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <HStack gap="1" color="blue.500" fontSize="xs">
              <LuExternalLink size={12} />
              <Text>View</Text>
            </HStack>
          </a>
        </HStack>
      )}
    </Box>
  );
}

function ResultsSidebar({
  sidebarResults,
  resultsByType,
}: {
  sidebarResults: ResultSet[];
  resultsByType: Record<string, ResultSet[]>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (sidebarResults.length === 0) {
    return (
      <VStack align="stretch" gap="3" py="4">
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          Results from your research queries will appear here.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap="3" overflowY="auto">
      {Object.entries(resultsByType).map(([toolName, resultSets]) => {
        const meta = TOOL_LABELS[toolName] || {
          label: toolName,
          icon: LuFileText,
        };
        const isCollapsed = collapsed[toolName];
        const allResults: ResultItem[] = resultSets.flatMap((rs: ResultSet) =>
          Array.isArray(rs.results) ? (rs.results as ResultItem[]) : [],
        );

        return (
          <Box key={toolName}>
            <HStack
              px="2"
              py="1"
              cursor="pointer"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [toolName]: !c[toolName] }))
              }
              _hover={{ bg: "bg.muted" }}
              borderRadius="md"
            >
              <Icon fontSize="sm">
                <meta.icon />
              </Icon>
              <Text fontSize="sm" fontWeight="semibold" flex="1">
                {meta.label}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {allResults.length} result{allResults.length !== 1 ? "s" : ""}
              </Text>
            </HStack>
            {!isCollapsed && (
              <VStack align="stretch" gap="2" pl="2" pt="1">
                {allResults.slice(0, 10).map((item: ResultItem, i: number) => (
                  <ResultCard
                    key={item.id || i}
                    item={item}
                    toolName={toolName}
                  />
                ))}
              </VStack>
            )}
          </Box>
        );
      })}
    </VStack>
  );
}

const emptyForm: Omit<Note, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  content: "",
  category: "research",
  tags: [],
};

const Research = observer(function Research() {
  const { researchStore, noteStore, caseStore } = useStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const activityStatus = useActivityStatus("research");
  const [saveNoteOpen, setSaveNoteOpen] = useState(false);
  const [saveNoteForm, setSaveNoteForm] =
    useState<Omit<Note, "id" | "createdAt" | "updatedAt">>(emptyForm);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [researchStore.messages.length, researchStore.isTyping]);

  const send = () => {
    const text = input.trim();
    if (!text || researchStore.isTyping) return;
    setInput("");
    researchStore.sendMessage(text);
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const openSaveNote = (text: string) => {
    setSaveNoteForm({
      title: "Research — " + text.slice(0, 50).replace(/\n/g, " "),
      content: text,
      category: "research",
      tags: ["research"],
    });
    setSaveNoteOpen(true);
  };

  const handleSaveNote = () => {
    noteStore.addNote(saveNoteForm);
    setSaveNoteOpen(false);
    setSaveNoteForm(emptyForm);
  };

  return (
    <HStack
      align="stretch"
      gap="0"
      h="calc(100vh - 64px)"
      maxH="calc(100vh - 64px)"
    >
      {/* Main Chat Area */}
      <VStack align="stretch" gap="0" flex="1" minW="0">
        <HStack pb="3" justify="space-between">
          <Heading size="2xl">Case Research</Heading>
          <HStack>
            <IconButton
              aria-label="Clear chat"
              variant="ghost"
              size="sm"
              onClick={() => researchStore.clearMessages()}
            >
              <LuTrash2 />
            </IconButton>
            <IconButton
              aria-label="Toggle results sidebar"
              variant="ghost"
              size="sm"
              onClick={() => researchStore.toggleSidebar()}
              data-testid="toggle-sidebar"
            >
              {researchStore.sidebarOpen ? (
                <LuPanelRightClose />
              ) : (
                <LuPanelRightOpen />
              )}
            </IconButton>
          </HStack>
        </HStack>

        <Box
          flex="1"
          overflowY="auto"
          borderWidth="1px"
          borderRadius="lg"
          p="4"
        >
          <VStack align="stretch" gap="4">
            {researchStore.messages.length === 0 && (
              <VStack gap="4" py="8">
                <Text color="fg.muted" textAlign="center">
                  Ask a legal research question to get started.
                </Text>
                <HStack gap="2" flexWrap="wrap" justify="center">
                  {QUICK_ACTIONS.map((action) => (
                    <Button
                      key={action.label}
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAction(action.prompt)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </HStack>
              </VStack>
            )}

            {researchStore.messages.map((msg) => (
              <HStack
                key={msg.id}
                align="start"
                gap="3"
                alignSelf={msg.role === "user" ? "flex-end" : "flex-start"}
                maxW="80%"
                flexDir={msg.role === "user" ? "row-reverse" : "row"}
              >
                <Box
                  borderRadius="full"
                  bg={msg.role === "assistant" ? "purple.500" : "blue.500"}
                  p="2"
                  color="white"
                  flexShrink={0}
                >
                  <Icon fontSize="md">
                    {msg.role === "assistant" ? <LuBot /> : <LuUser />}
                  </Icon>
                </Box>
                <VStack align="start" gap="1">
                  <Box
                    bg={msg.role === "assistant" ? "bg.subtle" : "blue.500"}
                    color={msg.role === "user" ? "white" : undefined}
                    px="4"
                    py="3"
                    borderRadius="xl"
                    fontSize="sm"
                    css={
                      msg.role === "assistant"
                        ? {
                            "& p": { marginBottom: "0.5em" },
                            "& p:last-child": { marginBottom: 0 },
                            "& ul, & ol": {
                              paddingLeft: "1.5em",
                              marginBottom: "0.5em",
                            },
                            "& h1, & h2, & h3": {
                              fontWeight: "bold",
                              marginTop: "0.75em",
                              marginBottom: "0.25em",
                            },
                            "& strong": { fontWeight: "bold" },
                          }
                        : { whiteSpace: "pre-wrap" }
                    }
                  >
                    {msg.role === "assistant" ? (
                      <Markdown>{msg.text}</Markdown>
                    ) : (
                      <Text>{msg.text}</Text>
                    )}
                  </Box>
                  {msg.role === "assistant" && (
                    <IconButton
                      aria-label="Save as note"
                      variant="ghost"
                      size="xs"
                      onClick={() => openSaveNote(msg.text)}
                    >
                      <LuStickyNote />
                    </IconButton>
                  )}
                </VStack>
              </HStack>
            ))}

            {researchStore.isTyping && (
              <HStack align="start" gap="3">
                <Box
                  borderRadius="full"
                  bg="purple.500"
                  p="2"
                  color="white"
                  flexShrink={0}
                >
                  <Icon fontSize="md">
                    <LuBot />
                  </Icon>
                </Box>
                <Box bg="bg.subtle" px="4" py="3" borderRadius="xl">
                  <Text fontSize="sm" color="fg.muted">
                    {activityStatus || "Researching..."}
                  </Text>
                </Box>
              </HStack>
            )}

            <div ref={bottomRef} />
          </VStack>
        </Box>

        <HStack pt="3" gap="2">
          <Input
            placeholder="Ask a research question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            size="lg"
            data-testid="research-input"
          />
          <IconButton
            aria-label="Send"
            onClick={send}
            size="lg"
            colorPalette="blue"
            data-testid="research-send-button"
          >
            <LuSend />
          </IconButton>
        </HStack>
      </VStack>

      {/* Results Sidebar */}
      {researchStore.sidebarOpen && (
        <Box
          w="320px"
          minW="320px"
          borderLeftWidth="1px"
          pl="4"
          overflowY="auto"
          display={{ base: "none", lg: "block" }}
        >
          <Text fontWeight="semibold" fontSize="sm" pb="3">
            Research Results
          </Text>
          <ResultsSidebar
            sidebarResults={researchStore.sidebarResults as ResultSet[]}
            resultsByType={researchStore.resultsByType}
          />
          {researchStore.sidebarResults.length === 0 && (
            <VStack gap="2" pt="4">
              <Text fontSize="xs" color="fg.muted" fontWeight="semibold">
                Quick Actions
              </Text>
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  size="xs"
                  variant="outline"
                  w="full"
                  onClick={() => handleQuickAction(action.prompt)}
                >
                  {action.label}
                </Button>
              ))}
            </VStack>
          )}
        </Box>
      )}
      <AddEditNoteDialog
        open={saveNoteOpen}
        onOpenChange={(o) => {
          setSaveNoteOpen(o);
          if (!o) setSaveNoteForm(emptyForm);
        }}
        form={saveNoteForm}
        onFormChange={setSaveNoteForm}
        onSave={handleSaveNote}
        cases={caseStore.cases.map((c) => ({ id: c.id, name: c.name }))}
      />
    </HStack>
  );
});

export default Research;
