import { useState, useMemo, useRef, useEffect } from "react";
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
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { parseLocalDate } from "../lib/dateUtils";

type EventSource =
  | "deadline"
  | "filing"
  | "evidence"
  | "case"
  | "finance"
  | "task";

interface TimelineEvent {
  id: string;
  date: Date;
  dateStr: string;
  title: string;
  source: EventSource;
  details?: string;
  isCritical: boolean;
  caseId?: string;
  metadata?: Record<string, string>;
}

const SOURCE_COLORS: Record<
  EventSource,
  { bg: string; border: string; palette: string }
> = {
  deadline: { bg: "orange.500/20", border: "orange.500", palette: "orange" },
  filing: { bg: "blue.500/20", border: "blue.500", palette: "blue" },
  evidence: { bg: "green.500/20", border: "green.500", palette: "green" },
  case: { bg: "purple.500/20", border: "purple.500", palette: "purple" },
  finance: { bg: "teal.500/20", border: "teal.500", palette: "teal" },
  task: { bg: "gray.500/20", border: "gray.500", palette: "gray" },
};

const SOURCE_LABELS: Record<EventSource, string> = {
  deadline: "Deadlines",
  filing: "Filings",
  evidence: "Evidence",
  case: "Cases",
  finance: "Finances",
  task: "Tasks",
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

function tryParseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return parseLocalDate(dateStr);
  }
  // ISO timestamp
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const Timeline = observer(function Timeline() {
  const {
    caseStore,
    deadlineStore,
    filingStore,
    evidenceStore,
    financeStore,
    taskStore,
  } = useStore();

  // Build unified events from all stores
  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Deadlines
    for (const d of deadlineStore.deadlines) {
      const date = tryParseDate(d.date);
      if (!date) continue;
      events.push({
        id: `deadline-${d.id}`,
        date,
        dateStr: d.date,
        title: d.title,
        source: "deadline",
        details: d.description || undefined,
        isCritical: d.priority === "high" || d.urgency === "overdue",
        caseId: d.caseId || undefined,
        metadata: {
          type: d.type,
          priority: d.priority,
          status: d.completed ? "completed" : d.urgency,
        },
      });
    }

    // Filings
    for (const f of filingStore.filings) {
      const date = tryParseDate(f.date);
      if (!date) continue;
      events.push({
        id: `filing-${f.id}`,
        date,
        dateStr: f.date,
        title: f.title,
        source: "filing",
        details: f.notes || undefined,
        isCritical: false,
        caseId: f.caseId || undefined,
        metadata: f.type ? { type: f.type } : undefined,
      });
    }

    // Evidence
    for (const e of evidenceStore.evidences) {
      const date = tryParseDate(e.dateCollected) || tryParseDate(e.createdAt);
      if (!date) continue;
      events.push({
        id: `evidence-${e.id}`,
        date,
        dateStr: e.dateCollected || toDateStr(new Date(e.createdAt)),
        title: e.title,
        source: "evidence",
        details: e.description || undefined,
        isCritical: e.relevance === "high",
        caseId: e.caseId || undefined,
        metadata: { type: e.type, relevance: e.relevance },
      });
    }

    // Cases (creation events)
    for (const c of caseStore.cases) {
      const date = tryParseDate(c.createdAt);
      if (!date) continue;
      events.push({
        id: `case-${c.id}`,
        date,
        dateStr: toDateStr(date),
        title: `Case opened: ${c.name}`,
        source: "case",
        details: c.notes || undefined,
        isCritical: false,
        caseId: c.id,
        metadata: {
          ...(c.caseNumber ? { number: c.caseNumber } : {}),
          ...(c.court ? { court: c.court } : {}),
          status: c.status,
        },
      });
    }

    // Finances
    for (const f of financeStore.entries) {
      const date = tryParseDate(f.date);
      if (!date) continue;
      events.push({
        id: `finance-${f.id}`,
        date,
        dateStr: f.date,
        title: `${f.category === "income" ? "Income" : "Expense"}: ${f.subcategory}`,
        source: "finance",
        details: f.description || undefined,
        isCritical: false,
        metadata: { category: f.category, amount: `$${f.amount.toFixed(2)}` },
      });
    }

    // Tasks (with due dates)
    for (const t of taskStore.tasks) {
      const date = tryParseDate(t.dueDate ?? "");
      if (!date) continue;
      events.push({
        id: `task-${t.id}`,
        date,
        dateStr: t.dueDate!,
        title: t.title,
        source: "task",
        details: t.description || undefined,
        isCritical: t.priority === "high",
        metadata: { priority: t.priority, status: t.status },
      });
    }

    // Sort chronologically
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return events;
  }, [
    deadlineStore.deadlines,
    filingStore.filings,
    evidenceStore.evidences,
    caseStore.cases,
    financeStore.entries,
    taskStore.tasks,
  ]);

  // Compute date bounds from data
  const { minDate, maxDate } = useMemo(() => {
    if (allEvents.length === 0) {
      const now = new Date();
      return { minDate: now, maxDate: now };
    }
    return {
      minDate: allEvents[0].date,
      maxDate: allEvents[allEvents.length - 1].date,
    };
  }, [allEvents]);

  const defaultStart = toDateStr(minDate);
  const defaultEnd = toDateStr(maxDate);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<EventSource | null>(null);
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  const effectiveStart = startDateFilter || defaultStart;
  const effectiveEnd = endDateFilter || defaultEnd;

  // Compute ruler and range
  const { rangeStart, rangeEnd, rulerMarks } = useMemo(() => {
    const start = parseLocalDate(effectiveStart);
    const end = parseLocalDate(effectiveEnd);
    const finalEnd = end >= start ? end : start;

    const marks: { label: string; pct: number }[] = [];
    const totalMs = finalEnd.getTime() - start.getTime();
    if (totalMs <= 0)
      return { rangeStart: start, rangeEnd: finalEnd, rulerMarks: marks };

    const startYear = start.getFullYear();
    const endYear = finalEnd.getFullYear();

    for (let y = startYear; y <= endYear; y++) {
      const yStart = new Date(y, 0, 1);
      const pct = ((yStart.getTime() - start.getTime()) / totalMs) * 100;
      if (pct >= 0 && pct <= 100) {
        marks.push({ label: String(y), pct });
      }
      for (let q = 1; q <= 3; q++) {
        const qStart = new Date(y, q * 3, 1);
        const qPct = ((qStart.getTime() - start.getTime()) / totalMs) * 100;
        if (qPct >= 0 && qPct <= 100) {
          marks.push({ label: MONTHS[q * 3], pct: qPct });
        }
      }
    }
    return { rangeStart: start, rangeEnd: finalEnd, rulerMarks: marks };
  }, [effectiveStart, effectiveEnd]);

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  function pctOffset(d: Date) {
    if (totalMs <= 0) return 50;
    return ((d.getTime() - rangeStart.getTime()) / totalMs) * 100;
  }

  const visibleEvents = useMemo(() => {
    let filtered = allEvents.filter(
      (e) => e.date >= rangeStart && e.date <= rangeEnd,
    );
    if (sourceFilter !== null)
      filtered = filtered.filter((e) => e.source === sourceFilter);
    return filtered;
  }, [allEvents, rangeStart, rangeEnd, sourceFilter]);

  const hasDateFilter = startDateFilter !== "" || endDateFilter !== "";
  const clearDateFilter = () => {
    setStartDateFilter("");
    setEndDateFilter("");
  };

  // Scroll-to-zoom on the timeline area
  const timelineRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef({ rangeStart, rangeEnd });
  rangeRef.current = { rangeStart, rangeEnd };

  const dragRef = useRef<{ startX: number; startMs: number; endMs: number } | null>(null);

  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, mouseX / rect.width));

      const { rangeStart: rs, rangeEnd: re } = rangeRef.current;
      const startMs = rs.getTime();
      const endMs = re.getTime();
      const currentTotalMs = endMs - startMs;
      if (currentTotalMs <= 0) return;

      const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const newTotalMs = currentTotalMs * zoomFactor;

      const MIN_RANGE_MS = 24 * 60 * 60 * 1000; // 1 day
      const MAX_RANGE_MS = 20 * 365.25 * 24 * 60 * 60 * 1000; // 20 years
      if (newTotalMs < MIN_RANGE_MS || newTotalMs > MAX_RANGE_MS) return;

      const cursorMs = startMs + ratio * currentTotalMs;
      const newStartMs = cursorMs - ratio * newTotalMs;
      const newEndMs = cursorMs + (1 - ratio) * newTotalMs;

      setStartDateFilter(toDateStr(new Date(newStartMs)));
      setEndDateFilter(toDateStr(new Date(newEndMs)));
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Ignore clicks on interactive child elements (expanded detail cards, etc.)
      if ((e.target as HTMLElement).closest("a, button, input")) return;
      e.preventDefault();
      const { rangeStart: rs, rangeEnd: re } = rangeRef.current;
      dragRef.current = {
        startX: e.clientX,
        startMs: rs.getTime(),
        endMs: re.getTime(),
      };
      container.style.cursor = "grabbing";
    };

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const pxDelta = e.clientX - drag.startX;
      const totalMs = drag.endMs - drag.startMs;
      const msDelta = (pxDelta / rect.width) * totalMs;

      setStartDateFilter(toDateStr(new Date(drag.startMs - msDelta)));
      setEndDateFilter(toDateStr(new Date(drag.endMs - msDelta)));
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        container.style.cursor = "";
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const sources: EventSource[] = [
    "deadline",
    "filing",
    "evidence",
    "case",
    "finance",
    "task",
  ];

  // Find case name by id for display
  const caseNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of caseStore.cases) {
      map[c.id] = c.name;
    }
    return map;
  }, [caseStore.cases]);

  return (
    <VStack align="stretch" gap="6">
      <HStack justify="space-between" flexWrap="wrap">
        <Heading size="2xl">Timeline</Heading>
        <HStack flexWrap="wrap">
          {sources.map((s) => (
            <Badge
              key={s}
              cursor="pointer"
              variant={sourceFilter === s ? "solid" : "outline"}
              colorPalette={SOURCE_COLORS[s].palette}
              onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
            >
              {SOURCE_LABELS[s]}
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
            value={effectiveStart}
            onChange={(e) => setStartDateFilter(e.target.value)}
            max={effectiveEnd}
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
            value={effectiveEnd}
            onChange={(e) => setEndDateFilter(e.target.value)}
            min={effectiveStart}
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

      {/* Zoomable timeline area */}
      <Box ref={timelineRef} cursor="grab" userSelect="none">
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
            {allEvents.length === 0
              ? "No data yet. Add deadlines, filings, evidence, or other records to see them here."
              : `No events in this range${sourceFilter !== null ? ` (${SOURCE_LABELS[sourceFilter]})` : ""}`}
          </Text>
        )}
        {visibleEvents.map((evt) => {
          const left = Math.max(0, Math.min(pctOffset(evt.date), 99));
          const colors = SOURCE_COLORS[evt.source];
          const isExpanded = expandedId === evt.id;
          return (
            <Box key={evt.id}>
              <Box
                pos="relative"
                h="32px"
                cursor="pointer"
                onClick={() => setExpandedId(isExpanded ? null : evt.id)}
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
                    {evt.isCritical && "\u26A0 "}
                    {evt.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
                    <Badge size="sm" colorPalette={colors.palette}>
                      {SOURCE_LABELS[evt.source]}
                    </Badge>
                    {evt.caseId && caseNameMap[evt.caseId] && (
                      <Badge size="sm" variant="outline">
                        {caseNameMap[evt.caseId]}
                      </Badge>
                    )}
                    {evt.metadata?.type && (
                      <Badge size="sm" variant="surface">
                        {evt.metadata.type}
                      </Badge>
                    )}
                    {evt.metadata?.amount && (
                      <Badge size="sm" variant="surface">
                        {evt.metadata.amount}
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
                </Box>
              )}
            </Box>
          );
        })}
      </VStack>
      </Box>

      {/* Legend */}
      <HStack gap="4" pt="4" borderTopWidth="1px" flexWrap="wrap">
        <Text fontSize="xs" color="fg.muted">
          Legend:
        </Text>
        {sources.map((s) => (
          <HStack key={s} gap="1">
            <Box w="3" h="3" borderRadius="sm" bg={SOURCE_COLORS[s].border} />
            <Text fontSize="xs" color="fg.muted">
              {SOURCE_LABELS[s]}
            </Text>
          </HStack>
        ))}
        <HStack gap="1">
          <Text fontSize="xs">{"\u26A0"}</Text>
          <Text fontSize="xs" color="fg.muted">
            Critical
          </Text>
        </HStack>
      </HStack>
    </VStack>
  );
});

export default Timeline;
