import {
  Box,
  Heading,
  VStack,
  Button,
  HStack,
  Text,
  Checkbox,
} from "@chakra-ui/react";
import { observer } from "mobx-react-lite";
import type { ReportConfig } from "../../../types";
import { useStore } from "../../../store/StoreContext";

interface ReportConfigFormProps {
  reportType: ReportConfig["type"];
  config: ReportConfig;
  onConfigChange: (config: ReportConfig) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export const ReportConfigForm = observer(function ReportConfigForm({
  reportType,
  config,
  onConfigChange,
  onBack,
  onGenerate,
}: ReportConfigFormProps) {
  const { caseStore } = useStore();
  const cases = caseStore.cases.map((c) => ({ id: c.id, name: c.name }));

  const getReportTitle = () => {
    switch (reportType) {
      case "case-summary":
        return "Case Summary Configuration";
      case "evidence-analysis":
        return "Evidence Analysis Configuration";
      case "financial":
        return "Financial Summary Configuration";
      case "chronology":
        return "Chronology Configuration";
    }
  };

  const needsCaseSelector =
    reportType === "case-summary" || reportType === "evidence-analysis";
  const needsDateRange =
    reportType === "financial" || reportType === "chronology";

  const isValid = () => {
    if (needsCaseSelector && !config.caseId) return false;
    if (needsDateRange && (!config.dateRange?.from || !config.dateRange?.to))
      return false;
    return true;
  };

  return (
    <Box maxW="800px" mx="auto" p={6}>
      <Heading mb={6}>{getReportTitle()}</Heading>
      <VStack align="stretch" gap={6}>
        {needsCaseSelector && (
          <Box w="full">
            <Text fontSize="sm" mb="1">
              Select Case *
            </Text>
            <select
              value={config.caseId ?? ""}
              onChange={(e) =>
                onConfigChange({ ...config, caseId: e.target.value })
              }
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid var(--chakra-colors-border)",
                background: "transparent",
                color: "inherit",
              }}
            >
              <option value="">-- Select a case --</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Box>
        )}

        {needsDateRange && (
          <>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                Start Date
              </Text>
              <input
                type="date"
                value={config.dateRange?.from ?? ""}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    dateRange: {
                      ...config.dateRange,
                      from: e.target.value,
                      to: config.dateRange?.to ?? "",
                    },
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--chakra-colors-border)",
                  background: "transparent",
                  color: "inherit",
                }}
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb="1">
                End Date
              </Text>
              <input
                type="date"
                value={config.dateRange?.to ?? ""}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    dateRange: {
                      ...config.dateRange,
                      from: config.dateRange?.from ?? "",
                      to: e.target.value,
                    },
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--chakra-colors-border)",
                  background: "transparent",
                  color: "inherit",
                }}
              />
            </Box>
          </>
        )}

        <Box w="full">
          <HStack gap="2">
            <Checkbox.Root
              checked={config.options.includeAI}
              onCheckedChange={(e) =>
                onConfigChange({
                  ...config,
                  options: { ...config.options, includeAI: e.checked === true },
                })
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
            </Checkbox.Root>
            <Text fontSize="sm">Include AI-generated strategic analysis</Text>
          </HStack>
        </Box>

        {reportType === "evidence-analysis" && (
          <Box w="full">
            <HStack gap="2">
              <Checkbox.Root
                checked={config.options.includeChainOfCustody ?? false}
                onCheckedChange={(e) =>
                  onConfigChange({
                    ...config,
                    options: {
                      ...config.options,
                      includeChainOfCustody: e.checked === true,
                    },
                  })
                }
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
              </Checkbox.Root>
              <Text fontSize="sm">Include chain of custody details</Text>
            </HStack>
          </Box>
        )}

        <HStack gap={3} justify="flex-end">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            colorPalette="blue"
            onClick={onGenerate}
            disabled={!isValid()}
          >
            Generate Report
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
});
