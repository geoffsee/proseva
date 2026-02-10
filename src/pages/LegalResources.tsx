import { Heading, Text, VStack } from "@chakra-ui/react";
import { CourtsList } from "../components/resources/CourtsList";
import { StatutesList } from "../components/resources/StatutesList";
import { DeadlinesList } from "../components/resources/DeadlinesList";
import { GlossaryList } from "../components/resources/GlossaryList";

export default function LegalResources() {
  return (
    <VStack align="stretch" gap="8">
      <Heading size="2xl">Legal Resources</Heading>
      <Text color="fg.muted">
        Virginia legal references for pro se litigants. This is general
        information, not legal advice.
      </Text>
      <CourtsList />
      <StatutesList />
      <DeadlinesList />
      <GlossaryList />
    </VStack>
  );
}
