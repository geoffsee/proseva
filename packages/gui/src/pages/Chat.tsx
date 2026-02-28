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
  LuStickyNote,
  LuArchive,
  LuHistory,
} from "react-icons/lu";
import { useState, useRef, useEffect } from "react";
import { AddEditNoteDialog } from "../components/notes/AddEditNoteDialog";
import type { Note } from "../types";
import { observer } from "mobx-react-lite";
import Markdown from "react-markdown";
import { useStore } from "../store/StoreContext";
import { useActivityStatus } from "../hooks/useActivityStatus";
import { useChatProcessTimeline } from "../hooks/useChatProcessTimeline";

const emptyForm: Omit<Note, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  content: "",
  category: "general",
  tags: [],
};

function formatConversationTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Updated";
  return `Updated ${date.toLocaleString()}`;
}

const Chat = observer(function Chat() {
  const { chatStore, noteStore, caseStore } = useStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const activityStatus = useActivityStatus("chat");
  const processTimeline = useChatProcessTimeline("chat");
  const [saveNoteOpen, setSaveNoteOpen] = useState(false);
  const [saveNoteForm, setSaveNoteForm] =
    useState<Omit<Note, "id" | "createdAt" | "updatedAt">>(emptyForm);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatStore.messages.length, chatStore.isTyping]);

  const send = () => {
    const text = input.trim();
    if (!text || chatStore.isTyping) return;
    setInput("");
    chatStore.sendMessage(text);
  };

  const openSaveNote = (text: string) => {
    setSaveNoteForm({
      title: "Chat — " + text.slice(0, 50).replace(/\n/g, " "),
      content: text,
      category: "general",
      tags: ["chat"],
    });
    setSaveNoteOpen(true);
  };

  const handleSaveNote = () => {
    noteStore.addNote(saveNoteForm);
    setSaveNoteOpen(false);
    setSaveNoteForm(emptyForm);
  };

  const archiveConversation = () => {
    chatStore.archiveConversation();
    processTimeline.reset();
    setInput("");
  };

  const selectConversation = (id: string) => {
    chatStore.loadConversation(id);
    processTimeline.reset();
    setHistoryOpen(false);
    setInput("");
  };

  const showProcessPanel =
    chatStore.isTyping ||
    (chatStore.messages.length > 0 && processTimeline.events.length > 0);
  const processStatusText =
    activityStatus ||
    processTimeline.currentMessage ||
    (chatStore.isTyping ? "Typing..." : "Ready");

  return (
    <VStack
      align="stretch"
      gap="0"
      h="calc(100vh - 64px)"
      maxH="calc(100vh - 64px)"
    >
      <HStack justify="space-between" align="center" pb="4">
        <Heading size="2xl">AI Assistant</Heading>
        <HStack gap="2" align="start">
          <Box position="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-label="Conversation history"
            >
              <LuHistory />
              History
            </Button>
            {historyOpen && (
              <Box
                position="absolute"
                top="calc(100% + 6px)"
                left={0}
                zIndex={20}
                bg="bg.panel"
                borderWidth="1px"
                borderRadius="md"
                boxShadow="md"
                minW="320px"
                maxH="320px"
                overflowY="auto"
              >
                {chatStore.historySorted.length === 0 ? (
                  <Text px="3" py="2" fontSize="sm" color="fg.muted">
                    No archived conversations yet.
                  </Text>
                ) : (
                  <VStack align="stretch" gap="0">
                    {chatStore.historySorted.map((conversation) => (
                      <Button
                        key={conversation.id}
                        justifyContent="flex-start"
                        variant="ghost"
                        borderRadius="0"
                        onClick={() => selectConversation(conversation.id)}
                        aria-label={`Open conversation ${conversation.title}`}
                        bg={
                          chatStore.selectedHistoryId === conversation.id
                            ? "bg.muted"
                            : undefined
                        }
                      >
                        <VStack align="start" gap="0" w="full" py="1">
                          <HStack justify="space-between" w="full" gap="2">
                            <Text fontSize="sm" fontWeight="medium" truncate>
                              {conversation.title}
                            </Text>
                            {chatStore.selectedHistoryId === conversation.id && (
                              <Text
                                fontSize="xs"
                                color="green.600"
                                fontWeight="semibold"
                              >
                                Active
                              </Text>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="fg.muted">
                            {formatConversationTimestamp(conversation.updatedAt)}
                          </Text>
                        </VStack>
                      </Button>
                    ))}
                  </VStack>
                )}
              </Box>
            )}
          </Box>
          <Button
            variant="outline"
            size="sm"
            onClick={archiveConversation}
            aria-label="Archive conversation"
            disabled={chatStore.messages.length === 0 || chatStore.isTyping}
          >
            <LuArchive />
            Archive
          </Button>
        </HStack>
      </HStack>

      <Box flex="1" overflowY="auto" borderWidth="1px" borderRadius="lg" p="4">
        <VStack align="stretch" gap="4">
          {chatStore.messages.length === 0 && (
            <Text color="fg.muted" textAlign="center" py="8">
              Send a message to start a conversation.
            </Text>
          )}

          {chatStore.messages.map((msg) => (
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

          {showProcessPanel && (
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
              <Box bg="bg.subtle" px="4" py="3" borderRadius="xl" minW="340px">
                <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                  {processStatusText}
                </Text>
                {processTimeline.events.length > 0 && (
                  <VStack align="stretch" gap="1" mt="2">
                    {processTimeline.events.slice(-8).map((event) => (
                      <HStack key={event.id} align="start" gap="2">
                        <Box
                          mt="6px"
                          boxSize="6px"
                          borderRadius="full"
                          bg={
                            event.stage === "error"
                              ? "red.400"
                              : event.stage === "final-generation-done"
                                ? "green.400"
                                : "blue.400"
                          }
                          flexShrink={0}
                        />
                        <VStack align="start" gap="0" flex="1">
                          <Text fontSize="xs">{event.message}</Text>
                          {event.detail && (
                            <Text fontSize="xs" color="fg.muted">
                              {event.detail}
                            </Text>
                          )}
                        </VStack>
                      </HStack>
                    ))}
                  </VStack>
                )}
                {processTimeline.toolSummaryText && (
                  <Box mt="3" pt="2" borderTopWidth="1px">
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: "12px" }}>
                        Tool summarizer response
                      </summary>
                      <Text
                        mt="2"
                        fontSize="xs"
                        color="fg.muted"
                        whiteSpace="pre-wrap"
                      >
                        {processTimeline.toolSummaryText}
                      </Text>
                    </details>
                  </Box>
                )}
                {processTimeline.sources.length > 0 && (
                  <Box mt="3" pt="2" borderTopWidth="1px">
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Relevant sources
                    </Text>
                    <VStack align="stretch" gap="1">
                      {processTimeline.sources.slice(0, 5).map((source) => (
                        <Text key={source.key} fontSize="xs">
                          {source.label}
                          {typeof source.score === "number"
                            ? ` (${source.score.toFixed(3)})`
                            : ""}
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                )}
              </Box>
            </HStack>
          )}

          <div ref={bottomRef} />
        </VStack>
      </Box>

      <HStack pt="3" gap="2">
        <Input
          placeholder="Ask about your case, deadlines, filings..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          size="lg"
          data-testid="chat-input"
        />
        <IconButton
          aria-label="Send"
          onClick={send}
          size="lg"
          colorPalette="blue"
          data-testid="chat-send-button"
        >
          <LuSend />
        </IconButton>
      </HStack>

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
    </VStack>
  );
});

export default Chat;
