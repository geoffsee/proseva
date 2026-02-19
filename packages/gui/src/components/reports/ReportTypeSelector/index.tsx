import { Box, Heading, Grid, Card, Text, VStack } from "@chakra-ui/react";
import { LuFolder, LuImage, LuDollarSign, LuClock } from "react-icons/lu";

interface ReportType {
  id: "case-summary" | "evidence-analysis" | "financial" | "chronology";
  title: string;
  description: string;
  icon: typeof LuFolder;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "case-summary",
    title: "Case Summary",
    description:
      "Complete overview of a case including deadlines, evidence, filings, and contacts",
    icon: LuFolder,
  },
  {
    id: "evidence-analysis",
    title: "Evidence Analysis",
    description:
      "Detailed evidence catalog with chain of custody and admissibility notes",
    icon: LuImage,
  },
  {
    id: "financial",
    title: "Financial Summary",
    description: "Comprehensive breakdown of all litigation-related expenses",
    icon: LuDollarSign,
  },
  {
    id: "chronology",
    title: "Chronology",
    description: "Timeline of all case events in chronological order",
    icon: LuClock,
  },
];

interface ReportTypeSelectorProps {
  onSelect: (type: ReportType["id"]) => void;
}

export function ReportTypeSelector({ onSelect }: ReportTypeSelectorProps) {
  return (
    <Box maxW="1200px" mx="auto" p={6}>
      <Heading mb={6}>Generate Report</Heading>
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
        {REPORT_TYPES.map((type) => (
          <Card.Root
            key={type.id}
            cursor="pointer"
            onClick={() => onSelect(type.id)}
            _hover={{ bg: "bg.muted" }}
            transition="background 0.2s"
          >
            <Card.Body>
              <VStack align="start" gap={3}>
                <Box fontSize="3xl" color="blue.500">
                  <type.icon />
                </Box>
                <Heading size="md">{type.title}</Heading>
                <Text color="fg.muted">{type.description}</Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        ))}
      </Grid>
    </Box>
  );
}
