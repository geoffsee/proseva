import { Box, Heading, HStack, Text, VStack, Button } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { format, isBefore, addDays } from "date-fns";
import { LuFolder, LuCalendar, LuFileText } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { StatCard } from "../components/shared/StatCard";
import { parseLocalDate } from "../lib/dateUtils";

const Dashboard = observer(function Dashboard() {
  const { caseStore, deadlineStore, financeStore } = useStore();
  const cases = caseStore.cases;
  const deadlines = deadlineStore.deadlines;
  const entries = financeStore.entries;

  const activeCases = cases.filter((c) => c.status === "active").length;
  const upcoming = deadlines
    .filter(
      (d) =>
        !d.completed &&
        isBefore(new Date(), addDays(parseLocalDate(d.date), 1)),
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const totalIncome = entries
    .filter((e) => e.category === "income")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries
    .filter((e) => e.category === "expense")
    .reduce((s, e) => s + e.amount, 0);

  return (
    <VStack align="stretch" gap="8">
      <Heading size="2xl">Dashboard</Heading>

      <HStack gap="4" flexWrap="wrap">
        <StatCard label="Active Cases" value={activeCases} />
        <StatCard label="Upcoming Deadlines" value={upcoming.length} />
        <StatCard
          label="Monthly Income"
          value={`$${totalIncome.toLocaleString()}`}
        />
        <StatCard
          label="Monthly Expenses"
          value={`$${totalExpenses.toLocaleString()}`}
        />
      </HStack>

      <Box>
        <Heading size="md" mb="3">
          Upcoming Deadlines
        </Heading>
        {upcoming.length === 0 ? (
          <Text color="fg.muted">No upcoming deadlines.</Text>
        ) : (
          <VStack align="stretch" gap="2">
            {upcoming.map((d) => (
              <HStack
                key={d.id}
                borderWidth="1px"
                p="3"
                borderRadius="md"
                justifyContent="space-between"
              >
                <Box>
                  <Text fontWeight="medium">{d.title}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {d.type}
                  </Text>
                </Box>
                <Text fontSize="sm" fontWeight="medium">
                  {format(parseLocalDate(d.date), "MMM d, yyyy")}
                </Text>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>

      <Box>
        <Heading size="md" mb="3">
          Quick Actions
        </Heading>
        <HStack gap="3" flexWrap="wrap">
          <Link to="/cases">
            <Button variant="outline" size="sm">
              <LuFolder /> New Case
            </Button>
          </Link>
          <Link to="/documents">
            <Button variant="outline" size="sm">
              <LuFileText /> Generate Document
            </Button>
          </Link>
          <Link to="/calendar">
            <Button variant="outline" size="sm">
              <LuCalendar /> Add Deadline
            </Button>
          </Link>
        </HStack>
      </Box>
    </VStack>
  );
});

export default Dashboard;
