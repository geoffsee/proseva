import { useState } from "react";
import {
  Button,
  Heading,
  HStack,
  VStack,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { LuPlus, LuUsers } from "react-icons/lu";
import { observer } from "mobx-react-lite";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/shared/EmptyState";
import { StatCard } from "../components/shared/StatCard";
import { AddContactDialog } from "../components/contacts/AddContactDialog";
import { ContactList } from "../components/contacts/ContactList";
import { ContactFilters } from "../components/contacts/ContactFilters";
import type { Contact } from "../types";

const INITIAL_FORM: Omit<Contact, "id"> = {
  name: "",
  role: "attorney",
  organization: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  caseId: "",
};

const Contacts = observer(function Contacts() {
  const { contactStore, caseStore } = useStore();
  const [open, setOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<Omit<Contact, "id">>({ ...INITIAL_FORM });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    contactStore.addContact(form);
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      role: contact.role,
      organization: contact.organization || "",
      phone: contact.phone || "",
      email: contact.email || "",
      address: contact.address || "",
      notes: contact.notes || "",
      caseId: contact.caseId || "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (editingContact) {
      contactStore.updateContact(editingContact.id, form);
      setEditingContact(null);
    } else {
      handleAdd();
    }
    setForm({ ...INITIAL_FORM });
    setOpen(false);
  };

  const handleDialogClose = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setEditingContact(null);
      setForm({ ...INITIAL_FORM });
    }
  };

  const filteredContacts =
    contactStore.filteredContacts as unknown as Contact[];
  const uniqueRoles = new Set(contactStore.contacts.map((c) => c.role)).size;
  const cases = caseStore.cases.map((c) => ({ id: c.id, name: c.name }));

  return (
    <VStack align="stretch" gap="6">
      <HStack justifyContent="space-between">
        <Heading size="2xl">Contacts</Heading>
        <Button size="sm" onClick={() => setOpen(true)}>
          <LuPlus /> Add Contact
        </Button>
      </HStack>

      <HStack gap="4" flexWrap="wrap">
        <StatCard
          label="Total Contacts"
          value={contactStore.contacts.length.toString()}
        />
        <StatCard label="Roles" value={uniqueRoles.toString()} />
      </HStack>

      <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap="6">
        <GridItem>
          <ContactFilters
            searchQuery={contactStore.searchQuery}
            onSearchChange={(q) => contactStore.setSearchQuery(q)}
            selectedRole={contactStore.selectedRole}
            onRoleChange={(r) => contactStore.setSelectedRole(r)}
            selectedCaseId={contactStore.selectedCaseId}
            onCaseChange={(c) => contactStore.setSelectedCaseId(c)}
            cases={cases}
            onClearFilters={() => contactStore.clearFilters()}
          />
        </GridItem>

        <GridItem>
          {filteredContacts.length === 0 &&
          contactStore.contacts.length === 0 ? (
            <EmptyState
              icon={LuUsers}
              title="No contacts yet"
              description="Keep track of attorneys, judges, clerks, and other contacts related to your cases."
            />
          ) : filteredContacts.length === 0 ? (
            <EmptyState
              icon={LuUsers}
              title="No matching contacts"
              description="Try adjusting your search or filters."
            />
          ) : (
            <ContactList
              contacts={filteredContacts}
              onEdit={handleEdit}
              onDelete={(id) => contactStore.deleteContact(id)}
            />
          )}
        </GridItem>
      </Grid>

      <AddContactDialog
        open={open}
        onOpenChange={handleDialogClose}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        isEdit={!!editingContact}
        cases={cases}
      />
    </VStack>
  );
});

export default Contacts;
