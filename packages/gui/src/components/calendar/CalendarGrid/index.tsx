import { useMemo } from "react";
import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import type { Deadline } from "../../../types";
import { parseLocalDate } from "../../../lib/dateUtils";

const TYPE_COLOR: Record<string, string> = {
  filing: "blue",
  hearing: "purple",
  discovery: "orange",
  other: "gray",
};

interface CalendarGridProps {
  currentMonth: Date;
  deadlines: Deadline[];
  onSelectDate: (dateStr: string) => void;
}

export function CalendarGrid({
  currentMonth,
  deadlines,
  onSelectDate,
}: CalendarGridProps) {
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const leadingBlanks = getDay(startOfMonth(currentMonth));

  const deadlinesForDate = (date: Date) =>
    deadlines.filter((d) => isSameDay(parseLocalDate(d.date), date));

  return (
    <>
      <SimpleGrid columns={7} gap="1" textAlign="center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <Text key={d} fontSize="xs" fontWeight="bold" color="fg.muted">
            {d}
          </Text>
        ))}
      </SimpleGrid>

      <SimpleGrid columns={7} gap="1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <Box key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayDl = deadlinesForDate(day);
          const today = isToday(day);
          const inMonth = isSameMonth(day, currentMonth);
          return (
            <Box
              key={dateStr}
              p="1"
              minH="70px"
              borderWidth="1px"
              borderRadius="md"
              cursor="pointer"
              bg={today ? "bg.emphasized" : undefined}
              opacity={inMonth ? 1 : 0.4}
              onClick={() => onSelectDate(dateStr)}
              _hover={{ bg: "bg.muted" }}
            >
              <Text fontSize="xs" fontWeight={today ? "bold" : "normal"}>
                {format(day, "d")}
              </Text>
              {dayDl.slice(0, 2).map((d) => (
                <Text
                  key={d.id}
                  fontSize="xs"
                  truncate
                  color={`${TYPE_COLOR[d.type]}.fg`}
                >
                  {d.completed ? "✓ " : ""}
                  {d.title}
                </Text>
              ))}
              {dayDl.length > 2 && (
                <Text fontSize="xs" color="fg.muted">
                  +{dayDl.length - 2} more
                </Text>
              )}
            </Box>
          );
        })}
      </SimpleGrid>
    </>
  );
}
