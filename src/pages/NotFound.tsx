import { VStack, Heading, Text, Button } from "@chakra-ui/react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <VStack py="20" gap="4">
      <Heading size="4xl">404</Heading>
      <Text color="fg.muted">Page not found.</Text>
      <Link to="/">
        <Button variant="outline">Go to Dashboard</Button>
      </Link>
    </VStack>
  );
}
