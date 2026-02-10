import { useState, useMemo } from "react";
import {
  Box,
  Heading,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Input,
} from "@chakra-ui/react";
import timelineData from "../../reference/case-documents/timeline_data.json";
import { parseLocalDate } from "../lib/dateUtils";

interface TimelineEvent {
  party: string;
  date: string;
  title: string;
  case: { type?: string; number?: string };
  isCritical: boolean;
  details?: string;
  source?: string;
}

const PARTY_COLORS: Record<string, { bg: string; border: string }> = {
  Father: { bg: "blue.500/20", border: "blue.500" },
  Mother: { bg: "red.500/20", border: "red.500" },
  Court: { bg: "purple.500/20", border: "purple.500" },
  "": { bg: "gray.500/20", border: "gray.500" },
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function assignYears(events: TimelineEvent[]) {
  let year = 2023;
  let prevMonth = 0;
  return events.map((e) => {
    const [mm, dd] = e.date.split("-").map(Number);
    if (mm < prevMonth - 2) year++;
    prevMonth = mm;
    const fullDate = new Date(year, mm - 1, dd);
    return { ...e, fullDate, year };
  });
}

export default function Timeline() {
  const enriched = useMemo(
    () => assignYears(timelineData.events as TimelineEvent[]),
    [],
  );
  const years = useMemo(
    () => [...new Set(enriched.map((e) => e.year))].sort(),
    [enriched],
  );
  const minYear = years[0];
  const maxYear = years[years.length - 1];

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [partyFilter, setPartyFilter] = useState<string | null>(null);
  const [startDateFilter, setStartDateFilter] = useState<string>(
    `${minYear}-01-01`,
  );
  const [endDateFilter, setEndDateFilter] = useState<string>(
    `${maxYear}-12-31`,
  );

  // Compute date range based on filters or defaults
  const { rangeStart, rangeEnd, rulerMarks } = useMemo(() => {
    const start = startDateFilter
      ? parseLocalDate(startDateFilter)
      : new Date(minYear, 0, 1);
    const end = endDateFilter
      ? parseLocalDate(endDateFilter)
      : new Date(maxYear, 11, 31);

    // Ensure end is after start
    const finalStart = start;
    const finalEnd = end > start ? end : start;

    const marks: { label: string; pct: number }[] = [];
    const startYear = finalStart.getFullYear();
    const endYear = finalEnd.getFullYear();

    for (let y = startYear; y <= endYear; y++) {
      const yStart = new Date(y, 0, 1);
      const pct =
        ((yStart.getTime() - finalStart.getTime()) /
          (finalEnd.getTime() - finalStart.getTime())) *
        100;
      if (pct >= 0 && pct <= 100) {
        marks.push({ label: String(y), pct });
      }
      // Add quarter marks
      for (let q = 1; q <= 3; q++) {
        const qStart = new Date(y, q * 3, 1);
        const qPct =
          ((qStart.getTime() - finalStart.getTime()) /
            (finalEnd.getTime() - finalStart.getTime())) *
          100;
        if (qPct >= 0 && qPct <= 100) {
          marks.push({ label: MONTHS[q * 3], pct: qPct });
        }
      }
    }
    return { rangeStart: finalStart, rangeEnd: finalEnd, rulerMarks: marks };
  }, [minYear, maxYear, startDateFilter, endDateFilter]);

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  function pctOffset(d: Date) {
    return ((d.getTime() - rangeStart.getTime()) / totalMs) * 100;
  }

  const visibleEvents = useMemo(() => {
    let filtered = enriched.filter(
      (e) => e.fullDate >= rangeStart && e.fullDate <= rangeEnd,
    );
    if (partyFilter !== null)
      filtered = filtered.filter((e) => e.party === partyFilter);
    return filtered;
  }, [enriched, rangeStart, rangeEnd, partyFilter]);

  const parties = ["Father", "Mother", "Court", ""];

  // Format default dates
  const defaultStartDate = `${minYear}-01-01`;
  const defaultEndDate = `${maxYear}-12-31`;

  const clearDateFilter = () => {
    setStartDateFilter(defaultStartDate);
    setEndDateFilter(defaultEndDate);
  };

  const hasDateFilter =
    startDateFilter !== defaultStartDate || endDateFilter !== defaultEndDate;

  return (
    <VStack align="stretch" gap="6">
      <HStack justify="space-between" flexWrap="wrap">
        <Heading size="2xl">Timeline</Heading>
        <HStack>
          {parties.map((p) => (
            <Badge
              key={p || "other"}
              cursor="pointer"
              variant={partyFilter === p ? "solid" : "outline"}
              colorPalette={
                p === "Father"
                  ? "blue"
                  : p === "Mother"
                    ? "red"
                    : p === "Court"
                      ? "purple"
                      : "gray"
              }
              onClick={() => setPartyFilter(partyFilter === p ? null : p)}
            >
              {p || "Other"}
            </Badge>
          ))}
        </HStack>
      </HStack>

      {/* Date range filter */}
      <HStack justify="center" gap="3" flexWrap="wrap">
        <HStack gap="2">
          <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
            From:
          </Text>
          <Input
            type="date"
            size="sm"
            w="150px"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            max={endDateFilter}
            data-testid="timeline-date-from"
          />
        </HStack>
        <HStack gap="2">
          <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
            To:
          </Text>
          <Input
            type="date"
            size="sm"
            w="150px"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            min={startDateFilter}
            data-testid="timeline-date-to"
          />
        </HStack>
        {hasDateFilter && (
          <Button size="sm" variant="ghost" onClick={clearDateFilter}>
            Reset
          </Button>
        )}
      </HStack>

      {/* Date range and event count */}
      <HStack justify="center" gap="3">
        <Text fontWeight="bold" fontSize="lg">
          {rangeStart.getFullYear()} – {rangeEnd.getFullYear()}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {visibleEvents.length} events
        </Text>
      </HStack>

      {/* Ruler */}
      <Box
        pos="relative"
        h="8"
        borderBottomWidth="1px"
        borderColor="border.muted"
      >
        {rulerMarks.map((mark, i) => {
          const isYear = mark.label.length === 4;
          return (
            <Text
              key={i}
              pos="absolute"
              left={`${mark.pct}%`}
              fontSize="xs"
              color={isYear ? "fg.default" : "fg.muted"}
              fontWeight={isYear ? "semibold" : "normal"}
              top="0"
            >
              {mark.label}
            </Text>
          );
        })}
      </Box>

      {/* Gantt rows */}
      <VStack align="stretch" gap="1" minH="200px">
        {visibleEvents.length === 0 && (
          <Text color="fg.muted" textAlign="center" py="8">
            No events in this range
            {partyFilter !== null ? ` (${partyFilter || "Other"})` : ""}
          </Text>
        )}
        {visibleEvents.map((evt, i) => {
          const left = Math.max(0, Math.min(pctOffset(evt.fullDate), 99));
          const colors = PARTY_COLORS[evt.party] || PARTY_COLORS[""];
          const isExpanded = expandedIdx === i;
          return (
            <Box key={i}>
              <Box
                pos="relative"
                h="32px"
                cursor="pointer"
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                _hover={{ bg: "bg.muted" }}
                borderRadius="sm"
              >
                <Box
                  pos="absolute"
                  left={`${left}%`}
                  top="0"
                  bottom="0"
                  w="2px"
                  bg={colors.border}
                  opacity={evt.isCritical ? 1 : 0.6}
                />
                <Box
                  pos="absolute"
                  left={`${left}%`}
                  top="4px"
                  h="24px"
                  minW="8px"
                  maxW={`${100 - left}%`}
                  w="fit-content"
                  bg={colors.bg}
                  borderLeftWidth="3px"
                  borderColor={colors.border}
                  borderRadius="0 4px 4px 0"
                  px="2"
                  display="flex"
                  alignItems="center"
                  whiteSpace="nowrap"
                >
                  <Text
                    fontSize="xs"
                    fontWeight={evt.isCritical ? "bold" : "normal"}
                    truncate
                  >
                    {evt.isCritical && "⚠ "}
                    {evt.fullDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    , {evt.year}
                    {" — "}
                    {evt.title}
                  </Text>
                </Box>
              </Box>

              {isExpanded && (
                <Box
                  ml={`${Math.min(left, 50)}%`}
                  p="3"
                  mb="2"
                  borderWidth="1px"
                  borderColor={colors.border}
                  borderRadius="md"
                  bg="bg.panel"
                  maxW="500px"
                >
                  <Text fontWeight="bold" fontSize="sm" mb="1">
                    {evt.title}
                  </Text>
                  <HStack gap="2" mb="2" flexWrap="wrap">
                    {evt.party && (
                      <Badge
                        size="sm"
                        colorPalette={
                          evt.party === "Father"
                            ? "blue"
                            : evt.party === "Mother"
                              ? "red"
                              : "purple"
                        }
                      >
                        {evt.party}
                      </Badge>
                    )}
                    {evt.case?.number && (
                      <Badge size="sm" variant="outline">
                        {evt.case.number}
                      </Badge>
                    )}
                    {evt.case?.type && (
                      <Badge size="sm" variant="surface">
                        {evt.case.type}
                      </Badge>
                    )}
                    {evt.isCritical && (
                      <Badge size="sm" colorPalette="orange">
                        Critical
                      </Badge>
                    )}
                  </HStack>
                  {evt.details && (
                    <Text fontSize="xs" color="fg.muted" whiteSpace="pre-line">
                      {evt.details}
                    </Text>
                  )}
                  {evt.source && (
                    <Text fontSize="xs" color="fg.subtle" mt="2">
                      {evt.source}
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </VStack>

      {/* Legend */}
      <HStack gap="4" pt="4" borderTopWidth="1px" flexWrap="wrap">
        <Text fontSize="xs" color="fg.muted">
          Legend:
        </Text>
        {[
          { label: "Father", color: "blue.500" },
          { label: "Mother", color: "red.500" },
          { label: "Court", color: "purple.500" },
          { label: "Other", color: "gray.500" },
        ].map((l) => (
          <HStack key={l.label} gap="1">
            <Box w="3" h="3" borderRadius="sm" bg={l.color} />
            <Text fontSize="xs" color="fg.muted">
              {l.label}
            </Text>
          </HStack>
        ))}
        <HStack gap="1">
          <Text fontSize="xs">⚠</Text>
          <Text fontSize="xs" color="fg.muted">
            Critical
          </Text>
        </HStack>
      </HStack>
    </VStack>
  );
}
