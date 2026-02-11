import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import CaseTracker from "./pages/CaseTracker";
import CaseDetail from "./pages/CaseDetail";
import DocumentGenerator from "./pages/DocumentGenerator";
import FinancialTracker from "./pages/FinancialTracker";
import LegalResources from "./pages/LegalResources";
import Calendar from "./pages/Calendar";
import Contacts from "./pages/Contacts";
import Notes from "./pages/Notes";
import Kanban from "./pages/Kanban";
import Chat from "./pages/Chat";
import Research from "./pages/Research";
import DocumentManager from "./pages/DocumentManager";
import Deadlines from "./pages/Deadlines";
import Filings from "./pages/Filings";
import Evidence from "./pages/Evidence";
import Timeline from "./pages/Timeline";
import Reports from "./pages/Reports";
import Search from "./pages/Search";
import Evaluations from "./pages/Evaluations";
import Config from "./pages/Config";
import EstatePlanning from "./pages/EstatePlanning";
import NotFound from "./pages/NotFound";
import { Toaster } from "./components/ui/toaster";
import { StoreProvider } from "./store/StoreContext";

function App() {
  return (
    <StoreProvider>
      <Toaster />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/search" element={<Search />} />
          <Route path="/deadlines" element={<Deadlines />} />
          <Route path="/filings" element={<Filings />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/cases" element={<CaseTracker />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/documents" element={<DocumentGenerator />} />
          <Route path="/finances" element={<FinancialTracker />} />
          <Route path="/resources" element={<LegalResources />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/tasks" element={<Kanban />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/research" element={<Research />} />
          <Route path="/document-manager" element={<DocumentManager />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/evaluations" element={<Evaluations />} />
          <Route path="/estate" element={<EstatePlanning />} />
          <Route path="/config" element={<Config />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </StoreProvider>
  );
}

export default App;
