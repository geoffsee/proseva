import {
  Box,
  Heading,
  HStack,
  VStack,
  Text,
  Input,
  IconButton,
  Icon,
} from "@chakra-ui/react";
import { LuSend, LuBot, LuUser, LuStickyNote } from "react-icons/lu";
import { useState, useRef, useEffect } from "react";
import { AddEditNoteDialog } from "../components/notes/AddEditNoteDialog";
import type { Note } from "../types";
import { observer } from "mobx-react-lite";
import Markdown from "react-markdown";
import { useStore } from "../store/StoreContext";
import { useActivityStatus } from "../hooks/useActivityStatus";

const emptyForm: Omit<Note, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  content: "",
  category: "general",
  tags: [],
};

const Chat = observer(function Chat() {
  const { chatStore, noteStore, caseStore } = useStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const activityStatus = useActivityStatus("chat");
  const [saveNoteOpen, setSaveNoteOpen] = useState(false);
  const [saveNoteForm, setSaveNoteForm] =
    useState<Omit<Note, "id" | "createdAt" | "updatedAt">>(emptyForm);

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

  return (
    <VStack
      align="stretch"
      gap="0"
      h="calc(100vh - 64px)"
      maxH="calc(100vh - 64px)"
    >
      <Heading size="2xl" pb="4">
        AI Assistant
      </Heading>

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

          {chatStore.isTyping && (
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
                  {activityStatus || "Typing..."}
                </Text>
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
