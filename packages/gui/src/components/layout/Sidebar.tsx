import { Box, VStack, Text, Icon, HStack, IconButton } from "@chakra-ui/react";
import { Link, useLocation } from "react-router-dom";
import {
  LuLayoutDashboard,
  LuFolder,
  LuFileText,
  LuDollarSign,
  LuBookOpen,
  LuCalendar,
  LuUsers,
  LuMenu,
  LuX,
  LuMessageSquare,
  LuArchive,
  LuStickyNote,
  LuKanban,
  LuClock,
  LuUpload,
  LuImage,
  LuChartGantt,
  LuFile,
  LuSearch,
  LuBell,
  LuSettings,
  LuScroll,
} from "react-icons/lu";
import { useState } from "react";
import { ColorModeButton } from "../ui/color-mode";

const NAV_SECTIONS = [
  {
    title: "Core",
    items: [
      { to: "/deadlines", label: "Deadlines", icon: LuClock },
      { to: "/filings", label: "Filings", icon: LuUpload },
      { to: "/evidence", label: "Evidence", icon: LuImage },
      { to: "/timeline", label: "Timeline", icon: LuChartGantt },
    ],
  },
  {
    title: "Data",
    items: [
      { to: "/cases", label: "Cases", icon: LuFolder },
      { to: "/document-manager", label: "Doc Manager", icon: LuArchive },
      { to: "/finances", label: "Finances", icon: LuDollarSign },
      { to: "/contacts", label: "Contacts", icon: LuUsers },
      { to: "/notes", label: "Notes", icon: LuStickyNote },
      { to: "/calendar", label: "Calendar", icon: LuCalendar },
    ],
  },
  {
    title: "Tools",
    items: [
      { to: "/", label: "Dashboard", icon: LuLayoutDashboard },
      { to: "/tasks", label: "Tasks", icon: LuKanban },
      { to: "/resources", label: "Resources", icon: LuBookOpen },
      { to: "/documents", label: "Document Generation", icon: LuFileText },
      { to: "/chat", label: "ProSeVA AI", icon: LuMessageSquare },
      { to: "/research", label: "Case Research", icon: LuSearch },
      { to: "/reports", label: "Reports", icon: LuFile },
      { to: "/evaluations", label: "Evaluations", icon: LuBell },
      { to: "/estate", label: "Estate Planning", icon: LuScroll },
    ],
  },
  {
    title: "System",
    items: [{ to: "/config", label: "Settings", icon: LuSettings }],
  },
];

export function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <VStack align="stretch" gap="1" flex="1">
      <HStack justify="space-between" align="center" px="3" pt="10" pb="4">
        <Text fontWeight="bold" fontSize="lg">
          ProSe VA
        </Text>
        <ColorModeButton />
      </HStack>

      {/* Search - Top level, outside categories */}
      <Link to="/search" onClick={() => setMobileOpen(false)}>
        <HStack
          px="3"
          py="2"
          borderRadius="md"
          bg={location.pathname === "/search" ? "bg.emphasized" : undefined}
          _hover={{ bg: "bg.muted" }}
          gap="3"
        >
          <Icon fontSize="lg">
            <>{LuSearch({})}</>
          </Icon>
          <Text fontSize="sm">Search</Text>
        </HStack>
      </Link>

      <Box h="2" />

      {NAV_SECTIONS.map((section) => (
        <Box key={section.title}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="gray.500"
            _dark={{ color: "gray.400" }}
            px="3"
            py="2"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            {section.title}
          </Text>
          {section.items.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
              >
                <HStack
                  px="3"
                  py="2"
                  borderRadius="md"
                  bg={active ? "bg.emphasized" : undefined}
                  _hover={{ bg: "bg.muted" }}
                  gap="3"
                >
                  <Icon fontSize="lg">
                    <>{item.icon({})}</>
                  </Icon>
                  <Text fontSize="sm">{item.label}</Text>
                </HStack>
              </Link>
            );
          })}
        </Box>
      ))}
      <Box flex="1" />
    </VStack>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Box
        display={{ base: "block", md: "none" }}
        pos="fixed"
        top="3"
        left="3"
        zIndex="overlay"
      >
        <IconButton
          aria-label="Toggle menu"
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <LuX /> : <LuMenu />}
        </IconButton>
      </Box>

      {/* Mobile overlay */}
      {mobileOpen && (
        <Box
          display={{ base: "block", md: "none" }}
          pos="fixed"
          inset="0"
          bg="blackAlpha.600"
          zIndex="modal"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <Box
        display={{ base: mobileOpen ? "flex" : "none", md: "none" }}
        pos="fixed"
        top="0"
        left="0"
        bottom="0"
        w="240px"
        bg="bg.panel"
        borderRightWidth="1px"
        zIndex="modal"
        flexDir="column"
      >
        {navContent}
      </Box>

      {/* Desktop sidebar */}
      <Box
        display={{ base: "none", md: "flex" }}
        w="220px"
        minH="100vh"
        borderRightWidth="1px"
        flexDir="column"
        pos="fixed"
        top="0"
        left="0"
        bottom="0"
        bg="bg.panel"
        overflowY="auto"
      >
        {navContent}
      </Box>
    </>
  );
}
