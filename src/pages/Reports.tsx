import { useState } from "react";
import { ReportTypeSelector } from "../components/reports/ReportTypeSelector";
import { ReportConfigForm } from "../components/reports/ReportConfigForm";
import { ReportPreview } from "../components/reports/ReportPreview";
import { api } from "../lib/api";
import { toaster } from "../components/ui/toaster";
import type { ReportConfig, GeneratedReport } from "../types";
import { Box, Spinner, Center } from "@chakra-ui/react";

type Step = "select" | "configure" | "preview";

export default function Reports() {
  const [step, setStep] = useState<Step>("select");
  const [config, setConfig] = useState<ReportConfig>({
    type: "case-summary",
    options: {
      includeAI: false,
    },
  });
  const [generatedReport, setGeneratedReport] =
    useState<GeneratedReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSelectType = (type: ReportConfig["type"]) => {
    setConfig({
      type,
      options: {
        includeAI: false,
      },
    });
    setStep("configure");
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const report = await api.reports.generate(config);
      if (report) {
        setGeneratedReport(report);
        setStep("preview");
      } else {
        toaster.create({
          title: "Failed to generate report",
          type: "error",
        });
      }
    } catch (error) {
      toaster.create({
        title: "Failed to generate report",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBack = () => {
    setStep("configure");
  };

  const handleBackToSelect = () => {
    setStep("select");
    setConfig({
      type: "case-summary",
      options: {
        includeAI: false,
      },
    });
  };

  const handleNewReport = () => {
    setStep("select");
    setConfig({
      type: "case-summary",
      options: {
        includeAI: false,
      },
    });
    setGeneratedReport(null);
  };

  if (isGenerating) {
    return (
      <Center h="100vh">
        <Box textAlign="center">
          <Spinner size="xl" mb={4} />
          <Box>Generating report...</Box>
        </Box>
      </Center>
    );
  }

  if (step === "preview" && generatedReport) {
    return (
      <ReportPreview
        report={generatedReport}
        onBack={handleBack}
        onNewReport={handleNewReport}
      />
    );
  }

  if (step === "configure") {
    return (
      <ReportConfigForm
        reportType={config.type}
        config={config}
        onConfigChange={setConfig}
        onBack={handleBackToSelect}
        onGenerate={handleGenerate}
      />
    );
  }

  return <ReportTypeSelector onSelect={handleSelectType} />;
}
