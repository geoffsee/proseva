import { useState } from "react";
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import { toaster } from "../ui/toaster";
import { faxApi } from "../../lib/api";
import { VIRGINIA_COURTS } from "../../lib/virginia";
import type { Filing } from "../../types";

interface SendFaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filing: Filing | null;
  courtName?: string;
  caseId?: string;
}

export function SendFaxDialog({
  open,
  onOpenChange,
  filing,
  courtName,
  caseId,
}: SendFaxDialogProps) {
  const [source, setSource] = useState<"court" | "manual">("court");
  const [manualFax, setManualFax] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [sending, setSending] = useState(false);

  // Find matching court from the case's court field
  const matchedCourt = courtName
    ? VIRGINIA_COURTS.find(
        (c) => c.name.toLowerCase() === courtName.toLowerCase(),
      )
    : undefined;

  const courtFax = matchedCourt?.fax ?? "";
  const courtLabel = matchedCourt?.name ?? "";

  const faxNumber = source === "court" ? courtFax : manualFax;
  const resolvedRecipientName =
    recipientName || (source === "court" ? courtLabel : "");

  const canSend = !!faxNumber.trim() && !!filing;

  const handleSend = async () => {
    if (!filing || !faxNumber.trim()) return;
    setSending(true);
    try {
      await faxApi.send({
        filingId: filing.id,
        caseId: caseId ?? filing.caseId ?? "",
        recipientName: resolvedRecipientName,
        recipientFax: faxNumber.trim(),
      });
      toaster.create({
        title: "Fax job created",
        description: `Fax queued for ${resolvedRecipientName || faxNumber}`,
        type: "success",
      });
      onOpenChange(false);
    } catch {
      toaster.create({
        title: "Failed to send fax",
        description: "An error occurred while creating the fax job.",
        type: "error",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSource("court");
      setManualFax("");
      setRecipientName("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => handleClose(e.open)}
      placement="center"
    >
      <DialogContent
        maxW="500px"
        maxH="90vh"
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
      >
        <DialogHeader>
          <DialogTitle>Send Fax</DialogTitle>
        </DialogHeader>
        <DialogBody overflowY="auto" maxH="calc(90vh - 150px)">
          <VStack gap="4">
            {filing && (
              <Box w="full" bg="bg.muted" p="3" borderRadius="md">
                <Text fontSize="sm" fontWeight="medium">
                  Filing: {filing.title}
                </Text>
                {filing.type && (
                  <Text fontSize="xs" color="fg.muted">
                    Type: {filing.type}
                  </Text>
                )}
              </Box>
            )}

            <Box w="full">
              <Text fontSize="sm" mb="2" fontWeight="medium">
                Fax Number Source
              </Text>
              <VStack gap="2" align="stretch">
                <label
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <input
                    type="radio"
                    name="fax-source"
                    checked={source === "court"}
                    onChange={() => setSource("court")}
                  />
                  <Text fontSize="sm">
                    Court Fax
                    {courtFax ? ` (${courtFax})` : " — no fax on file"}
                  </Text>
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <input
                    type="radio"
                    name="fax-source"
                    checked={source === "manual"}
                    onChange={() => setSource("manual")}
                  />
                  <Text fontSize="sm">Manual Entry</Text>
                </label>
              </VStack>
            </Box>

            {source === "manual" && (
              <Box w="full">
                <Text fontSize="sm" mb="1">
                  Fax Number *
                </Text>
                <Input
                  type="tel"
                  value={manualFax}
                  onChange={(e) => setManualFax(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </Box>
            )}

            <Box w="full">
              <Text fontSize="sm" mb="1">
                Recipient Name
              </Text>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={
                  source === "court" && courtLabel
                    ? courtLabel
                    : "Court clerk name"
                }
              />
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            {sending ? "Sending..." : "Send Fax"}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}
