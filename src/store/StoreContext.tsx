import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { IRootStore } from "./RootStore";
import { createRootStore } from "./RootStore";

const StoreContext = createContext<IRootStore | null>(null);

let _store: IRootStore | undefined;

function getStore(): IRootStore {
  if (!_store) {
    _store = createRootStore();
    // Load data from API
    _store.documentStore.loadDocuments();
    _store.caseStore.loadCases();
    _store.deadlineStore.loadDeadlines();
    _store.contactStore.loadContacts();
    _store.financeStore.loadEntries();
    _store.evidenceStore.loadEvidences();
    _store.filingStore.loadFilings();
    _store.estatePlanStore.loadPlans();
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
  return (
    <StoreContext.Provider value={store ?? getStore()}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): IRootStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within StoreProvider");
  return store;
}
