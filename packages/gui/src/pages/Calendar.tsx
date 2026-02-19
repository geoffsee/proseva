import { useState } from "react";
import { Button, Heading, HStack, VStack, IconButton } from "@chakra-ui/react";
import { format, addMonths, subMonths } from "date-fns";
import { LuPlus, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { DayDetail } from "../components/calendar/DayDetail";
import { AddDeadlineDialog } from "../components/calendar/AddDeadlineDialog";
import type { Deadline } from "../types";

const Calendar = observer(function Calendar() {
  const { deadlineStore, caseStore } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Deadline, "id">>({
    title: "",
    date: "",
    type: "filing",
    completed: false,
    caseId: "",
  });

  const openAdd = (dateStr?: string) => {
    setForm({
      title: "",
      date: dateStr ?? "",
      type: "filing",
      completed: false,
      caseId: "",
    });
    setOpen(true);
  };

  const handleAdd = () => {
    if (!form.title || !form.date) return;
    deadlineStore.addDeadline(form);
    setForm({
      title: "",
      date: "",
      type: "filing",
      completed: false,
      caseId: "",
    });
    setOpen(false);
  };

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Calendar</Heading>
        <Button size="sm" onClick={() => openAdd()}>
          <LuPlus /> Add Deadline
        </Button>
      </HStack>

      <HStack justifyContent="center" gap="4">
        <IconButton
          aria-label="Previous month"
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <LuChevronLeft />
        </IconButton>
        <Heading size="md">{format(currentMonth, "MMMM yyyy")}</Heading>
        <IconButton
          aria-label="Next month"
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <LuChevronRight />
        </IconButton>
      </HStack>

      <CalendarGrid
        currentMonth={currentMonth}
        deadlines={
          deadlineStore.deadlines.map((d) => ({
            ...d,
            caseId: d.caseId || undefined,
          })) as Deadline[]
        }
        onSelectDate={setSelectedDate}
      />

      {selectedDate && (
        <DayDetail
          selectedDate={selectedDate}
          deadlines={
            deadlineStore.deadlines.map((d) => ({
              ...d,
              caseId: d.caseId || undefined,
            })) as Deadline[]
          }
          onAdd={openAdd}
          onToggleComplete={(id) => deadlineStore.toggleComplete(id)}
          onDelete={(id) => deadlineStore.deleteDeadline(id)}
        />
      )}

      <AddDeadlineDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        onFormChange={setForm}
        onAdd={handleAdd}
        cases={caseStore.cases as unknown as import("../types").Case[]}
      />
    </VStack>
  );
});

export default Calendar;
