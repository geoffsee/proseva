/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { IRootStore } from "./RootStore";
import { createRootStore, hydrateStore } from "./RootStore";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";

const StoreContext = createContext<IRootStore | null>(null);

let _store: IRootStore | undefined;

function getStore(): IRootStore {
  if (!_store) {
    _store = createRootStore();
  }
  return _store;
}

export function StoreProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: IRootStore;
}) {
  const resolvedStore = store ?? getStore();
  const [isReady, setIsReady] = useState(
    // If a custom store is provided (e.g., in tests), skip hydration
    store != null,
  );

  useEffect(() => {
    if (store) return; // Custom store — already ready

    let cancelled = false;
    void hydrateStore(resolvedStore)
      .then(() => {
        if (cancelled) return;
        // Load data from API after hydration so local data shows first
        resolvedStore.documentStore.loadDocuments();
        resolvedStore.caseStore.loadCases();
        resolvedStore.deadlineStore.loadDeadlines();
        resolvedStore.contactStore.loadContacts();
        resolvedStore.financeStore.loadEntries();
        resolvedStore.evidenceStore.loadEvidences();
        resolvedStore.filingStore.loadFilings();
        resolvedStore.estatePlanStore.loadPlans();
        setIsReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[store] Hydration failed; continuing with defaults.", err);
        setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedStore, store]);

  if (!isReady) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minH="100vh"
      >
        <VStack gap={4}>
          <Spinner size="lg" />
          <Text color="fg.muted">Loading your data...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <StoreContext.Provider value={resolvedStore}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): IRootStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within StoreProvider");
  return store;
}
