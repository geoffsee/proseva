import {
  Box,
  Heading,
  VStack,
  Button,
  HStack,
  Text,
  Separator,
} from "@chakra-ui/react";
import { LuPrinter, LuCopy, LuArrowLeft, LuFilePlus } from "react-icons/lu";
import { toaster } from "../../ui/toaster";
import type { GeneratedReport } from "../../../types";

interface ReportPreviewProps {
  report: GeneratedReport;
  onBack: () => void;
  onNewReport: () => void;
}

export function ReportPreview({
  report,
  onBack,
  onNewReport,
}: ReportPreviewProps) {
  const handleCopy = async () => {
    const fullText = [
      report.title,
      "",
      `Generated: ${new Date(report.metadata.generatedAt).toLocaleString()}`,
      report.metadata.caseName ? `Case: ${report.metadata.caseName}` : "",
      report.metadata.dateRange
        ? `Date Range: ${report.metadata.dateRange}`
        : "",
      "",
      ...report.sections.flatMap((section) => [
        "",
        `## ${section.heading}`,
        "",
        section.content,
      ]),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(fullText);
      toaster.create({
        title: "Copied to clipboard",
        type: "success",
      });
    } catch (error) {
      toaster.create({
        title: "Failed to copy",
        type: "error",
      });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
              line-height: 1.6;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 10px;
            }
            h2 {
              font-size: 20px;
              margin-top: 30px;
              margin-bottom: 15px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 5px;
            }
            .metadata {
              color: #718096;
              font-size: 14px;
              margin-bottom: 30px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            table th, table td {
              border: 1px solid #e2e8f0;
              padding: 8px 12px;
              text-align: left;
            }
            table th {
              background-color: #f7fafc;
              font-weight: 600;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .content {
              margin-bottom: 20px;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <h1>${report.title}</h1>
          <div class="metadata">
            <div>Generated: ${new Date(report.metadata.generatedAt).toLocaleString()}</div>
            ${report.metadata.caseName ? `<div>Case: ${report.metadata.caseName}</div>` : ""}
            ${report.metadata.dateRange ? `<div>Date Range: ${report.metadata.dateRange}</div>` : ""}
          </div>
          ${report.sections
            .map(
              (section) => `
            <h2>${section.heading}</h2>
            <div class="content">${formatContent(section.content, section.type)}</div>
          `,
            )
            .join("")}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const formatContent = (content: string, type: string) => {
    if (type === "table") {
      // Content is already formatted as markdown table, convert to HTML
      const lines = content.trim().split("\n");
      if (lines.length < 2) return `<pre>${content}</pre>`;

      const headerRow = lines[0];
      const dataRows = lines.slice(2); // Skip separator row

      const headers = headerRow.split("|").filter((h) => h.trim());
      const tableHTML = `
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h.trim()}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${dataRows
              .map((row) => {
                const cells = row.split("|").filter((c) => c.trim());
                return `<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`;
              })
              .join("")}
          </tbody>
        </table>
      `;
      return tableHTML;
    }

    return `<pre>${content}</pre>`;
  };

  const renderContent = (content: string, type: string) => {
    if (type === "table") {
      // Render as pre-formatted text for preview
      return (
        <Box
          fontFamily="mono"
          fontSize="sm"
          whiteSpace="pre-wrap"
          bg="bg.muted"
          p={4}
          borderRadius="md"
          overflowX="auto"
        >
          {content}
        </Box>
      );
    }

    return (
      <Box whiteSpace="pre-wrap" lineHeight="tall">
        {content}
      </Box>
    );
  };

  return (
    <Box maxW="1000px" mx="auto" p={6}>
      <VStack align="stretch" gap={6}>
        <HStack justify="space-between">
          <Heading>{report.title}</Heading>
          <HStack gap={2}>
            <Button variant="outline" size="sm" onClick={onBack}>
              <LuArrowLeft /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <LuCopy /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <LuPrinter /> Print
            </Button>
            <Button colorPalette="blue" size="sm" onClick={onNewReport}>
              <LuFilePlus /> New Report
            </Button>
          </HStack>
        </HStack>

        <Box fontSize="sm" color="fg.muted">
          <Text>
            Generated: {new Date(report.metadata.generatedAt).toLocaleString()}
          </Text>
          {report.metadata.caseName && (
            <Text>Case: {report.metadata.caseName}</Text>
          )}
          {report.metadata.dateRange && (
            <Text>Date Range: {report.metadata.dateRange}</Text>
          )}
        </Box>

        <Separator />

        {report.sections.map((section, index) => (
          <Box key={index}>
            <Heading size="lg" mb={4}>
              {section.heading}
            </Heading>
            {renderContent(section.content, section.type)}
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
