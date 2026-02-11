import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Card,
  Badge,
  Button,
  Spinner,
  Input,
  IconButton,
  Separator,
  For,
  Stack,
} from "@chakra-ui/react";
import {
  FiPlay,
  FiClock,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiBell,
  FiPhone,
  FiTrash2,
  FiPlus,
} from "react-icons/fi";
import { useStore } from "../store/StoreContext";
import { toaster } from "../components/ui/toaster";

const Evaluations = observer(() => {
  const { evaluationStore } = useStore();
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneName, setNewPhoneName] = useState("");

  useEffect(() => {
    evaluationStore.loadAll();
  }, [evaluationStore]);

  const handleTriggerEvaluation = async () => {
    try {
      const result = await evaluationStore.triggerEvaluation();
      toaster.create({
        title: "Evaluation triggered",
        description: `Push: ${result.pushSent ? "sent" : "not sent"}, SMS: ${result.smsSent ? "sent" : "not sent"}`,
        type: "success",
      });
    } catch {
      toaster.create({
        title: "Evaluation failed",
        description: "Could not trigger evaluation. Check server logs.",
        type: "error",
      });
    }
  };

  const handleAddSmsRecipient = async () => {
    if (!newPhone.trim()) return;
    try {
      await evaluationStore.addSmsRecipient(
        newPhone.trim(),
        newPhoneName.trim() || undefined,
      );
      setNewPhone("");
      setNewPhoneName("");
      toaster.create({ title: "Phone number added", type: "success" });
    } catch {
      toaster.create({ title: "Failed to add phone number", type: "error" });
    }
  };

  const handleRemoveSmsRecipient = async (id: string) => {
    try {
      await evaluationStore.removeSmsRecipient(id);
      toaster.create({ title: "Phone number removed", type: "success" });
    } catch {
      toaster.create({ title: "Failed to remove phone number", type: "error" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge colorPalette="green">
            <FiCheck /> Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge colorPalette="red">
            <FiX /> Failed
          </Badge>
        );
      case "analyzing":
        return (
          <Badge colorPalette="blue">
            <Spinner size="xs" /> Analyzing
          </Badge>
        );
      case "sending":
        return (
          <Badge colorPalette="blue">
            <Spinner size="xs" /> Sending
          </Badge>
        );
      default:
        return (
          <Badge colorPalette="gray">
            <FiClock /> {status}
          </Badge>
        );
    }
  };

  const { schedulerStatus } = evaluationStore;

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack gap={6} align="stretch">
        <HStack justify="space-between" wrap="wrap" gap={4}>
          <Box>
            <Heading size="lg">Daily Evaluations</Heading>
            <Text color="fg.muted">
              AI-powered case deadline analysis and notifications
            </Text>
          </Box>
          <Button
            colorPalette="blue"
            onClick={handleTriggerEvaluation}
            loading={evaluationStore.isTriggering}
          >
            <FiPlay /> Run Now
          </Button>
        </HStack>

        {/* Scheduler Status */}
        {schedulerStatus && (
          <Card.Root>
            <Card.Body>
              <HStack justify="space-between" wrap="wrap" gap={4}>
                <VStack align="start" gap={1}>
                  <Text fontWeight="medium">Scheduler Status</Text>
                  <HStack gap={2}>
                    <Badge
                      colorPalette={schedulerStatus.enabled ? "green" : "gray"}
                    >
                      {schedulerStatus.enabled ? "Active" : "Disabled"}
                    </Badge>
                    {schedulerStatus.running && (
                      <Badge colorPalette="blue">
                        <Spinner size="xs" /> Running
                      </Badge>
                    )}
                  </HStack>
                </VStack>
                <VStack align="end" gap={1}>
                  <Text fontSize="sm" color="fg.muted">
                    Next run:{" "}
                    {schedulerStatus.nextRunTime
                      ? new Date(schedulerStatus.nextRunTime).toLocaleString()
                      : "Not scheduled"}
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    Timezone: {schedulerStatus.timezone}
                  </Text>
                </VStack>
              </HStack>
              <Separator my={4} />
              <HStack gap={6} wrap="wrap">
                <HStack gap={2}>
                  <FiBell />
                  <Text fontSize="sm">
                    Push:{" "}
                    {schedulerStatus.channels.firebase.configured
                      ? `${schedulerStatus.channels.firebase.tokenCount} device(s)`
                      : "Not configured"}
                  </Text>
                </HStack>
                <HStack gap={2}>
                  <FiPhone />
                  <Text fontSize="sm">
                    SMS:{" "}
                    {schedulerStatus.channels.twilio.configured
                      ? `${schedulerStatus.channels.twilio.recipientCount} recipient(s)`
                      : "Not configured"}
                  </Text>
                </HStack>
              </HStack>
            </Card.Body>
          </Card.Root>
        )}

        {/* SMS Recipients Management */}
        <Card.Root>
          <Card.Header>
            <Heading size="sm">SMS Recipients</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={4} align="stretch">
              <HStack gap={2}>
                <Input
                  placeholder="Phone number (+1...)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  flex={1}
                />
                <Input
                  placeholder="Name (optional)"
                  value={newPhoneName}
                  onChange={(e) => setNewPhoneName(e.target.value)}
                  flex={1}
                />
                <Button colorPalette="green" onClick={handleAddSmsRecipient}>
                  <FiPlus /> Add
                </Button>
              </HStack>
              {evaluationStore.smsRecipients.length > 0 ? (
                <VStack gap={2} align="stretch">
                  <For each={evaluationStore.smsRecipients}>
                    {(recipient) => (
                      <HStack
                        key={recipient.id}
                        justify="space-between"
                        p={2}
                        bg="bg.subtle"
                        borderRadius="md"
                      >
                        <HStack gap={2}>
                          <FiPhone />
                          <Text>{recipient.name || recipient.phone}</Text>
                          {recipient.name && (
                            <Text fontSize="sm" color="fg.muted">
                              {recipient.phone}
                            </Text>
                          )}
                          <Badge
                            colorPalette={recipient.active ? "green" : "gray"}
                          >
                            {recipient.active ? "Active" : "Inactive"}
                          </Badge>
                        </HStack>
                        <IconButton
                          aria-label="Remove recipient"
                          size="sm"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => handleRemoveSmsRecipient(recipient.id)}
                        >
                          <FiTrash2 />
                        </IconButton>
                      </HStack>
                    )}
                  </For>
                </VStack>
              ) : (
                <Text color="fg.muted" fontSize="sm">
                  No SMS recipients registered
                </Text>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Evaluation History */}
        <Card.Root>
          <Card.Header>
            <Heading size="sm">Evaluation History</Heading>
          </Card.Header>
          <Card.Body>
            {evaluationStore.isLoading ? (
              <HStack justify="center" p={8}>
                <Spinner />
                <Text>Loading evaluations...</Text>
              </HStack>
            ) : evaluationStore.sortedEvaluations.length === 0 ? (
              <Text color="fg.muted" textAlign="center" p={8}>
                No evaluations yet. Click "Run Now" to trigger the first
                evaluation.
              </Text>
            ) : (
              <VStack gap={4} align="stretch">
                <For each={evaluationStore.sortedEvaluations}>
                  {(evaluation) => (
                    <Card.Root key={evaluation.id} variant="outline">
                      <Card.Body>
                        <VStack gap={3} align="stretch">
                          <HStack justify="space-between" wrap="wrap" gap={2}>
                            <HStack gap={2}>
                              <Text fontWeight="medium">
                                {new Date(
                                  evaluation.createdAt,
                                ).toLocaleString()}
                              </Text>
                              {getStatusBadge(evaluation.status)}
                            </HStack>
                            <HStack gap={2}>
                              {evaluation.notification.pushSent && (
                                <Badge colorPalette="blue">
                                  <FiBell /> Push
                                </Badge>
                              )}
                              {evaluation.notification.smsSent && (
                                <Badge colorPalette="purple">
                                  <FiPhone /> SMS
                                </Badge>
                              )}
                            </HStack>
                          </HStack>

                          {evaluation.error && (
                            <Text color="red.500" fontSize="sm">
                              Error: {evaluation.error}
                            </Text>
                          )}

                          <Box bg="bg.subtle" p={3} borderRadius="md">
                            <Text fontWeight="medium">
                              {evaluation.notification.title}
                            </Text>
                            <Text fontSize="sm" color="fg.muted">
                              {evaluation.notification.body}
                            </Text>
                          </Box>

                          <Stack
                            direction={{ base: "column", md: "row" }}
                            gap={4}
                          >
                            <Box flex={1}>
                              <HStack gap={1} mb={1}>
                                <FiAlertTriangle color="red" />
                                <Text fontSize="sm" fontWeight="medium">
                                  Overdue (
                                  {evaluation.analysis.overdueDeadlines.length})
                                </Text>
                              </HStack>
                              {evaluation.analysis.overdueDeadlines.length >
                              0 ? (
                                <VStack gap={1} align="stretch">
                                  <For
                                    each={evaluation.analysis.overdueDeadlines.slice(
                                      0,
                                      3,
                                    )}
                                  >
                                    {(deadline) => (
                                      <Text
                                        key={deadline.id}
                                        fontSize="sm"
                                        color="fg.muted"
                                      >
                                        {deadline.title} -{" "}
                                        {deadline.daysOverdue} days overdue
                                      </Text>
                                    )}
                                  </For>
                                  {evaluation.analysis.overdueDeadlines.length >
                                    3 && (
                                    <Text fontSize="sm" color="fg.muted">
                                      +
                                      {evaluation.analysis.overdueDeadlines
                                        .length - 3}{" "}
                                      more
                                    </Text>
                                  )}
                                </VStack>
                              ) : (
                                <Text fontSize="sm" color="fg.muted">
                                  None
                                </Text>
                              )}
                            </Box>

                            <Box flex={1}>
                              <HStack gap={1} mb={1}>
                                <FiClock color="orange" />
                                <Text fontSize="sm" fontWeight="medium">
                                  Upcoming (
                                  {evaluation.analysis.upcomingDeadlines.length}
                                  )
                                </Text>
                              </HStack>
                              {evaluation.analysis.upcomingDeadlines.length >
                              0 ? (
                                <VStack gap={1} align="stretch">
                                  <For
                                    each={evaluation.analysis.upcomingDeadlines.slice(
                                      0,
                                      3,
                                    )}
                                  >
                                    {(deadline) => (
                                      <Text
                                        key={deadline.id}
                                        fontSize="sm"
                                        color="fg.muted"
                                      >
                                        {deadline.title} -{" "}
                                        {deadline.daysUntil === 0
                                          ? "Today"
                                          : deadline.daysUntil === 1
                                            ? "Tomorrow"
                                            : `${deadline.daysUntil} days`}
                                      </Text>
                                    )}
                                  </For>
                                  {evaluation.analysis.upcomingDeadlines
                                    .length > 3 && (
                                    <Text fontSize="sm" color="fg.muted">
                                      +
                                      {evaluation.analysis.upcomingDeadlines
                                        .length - 3}{" "}
                                      more
                                    </Text>
                                  )}
                                </VStack>
                              ) : (
                                <Text fontSize="sm" color="fg.muted">
                                  None
                                </Text>
                              )}
                            </Box>
                          </Stack>

                          {evaluation.analysis.aiSummary && (
                            <Box>
                              <Text fontSize="sm" fontWeight="medium" mb={1}>
                                AI Summary
                              </Text>
                              <Text
                                fontSize="sm"
                                color="fg.muted"
                                fontStyle="italic"
                              >
                                {evaluation.analysis.aiSummary}
                              </Text>
                            </Box>
                          )}
                        </VStack>
                      </Card.Body>
                    </Card.Root>
                  )}
                </For>
              </VStack>
            )}
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  );
});

export default Evaluations;
