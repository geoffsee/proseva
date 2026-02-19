import { Box } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <Box display="flex" minH="100vh">
      <Sidebar />
      <Box
        flex="1"
        ml={{ base: "0", md: "220px" }}
        p={{ base: "4", md: "8" }}
        pt={{ base: "14", md: "8" }}
        maxW="1100px"
      >
        <Outlet />
      </Box>
    </Box>
  );
}
