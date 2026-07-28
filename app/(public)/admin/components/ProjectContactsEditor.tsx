"use client";

import { useState } from "react";
import { updateContactField, addProjectContact, removeProjectContact } from "../contactActions";
import type { ProjectStakeholder } from "@/lib/data-access/projects";

type FieldStatus = "idle" | "saving" | "saved" | "error";
type ContactField = "name" | "email" | "phone";

interface EditableContact {
  personId: string;
  name: string;
  email: string;
  phone: string;
}

function toEditable(s: ProjectStakeholder): EditableContact {
  return { personId: s.personId, name: s.name, email: s.email ?? "", phone: s.phone ?? "" };
}

function FieldHint({ status, error }: { status?: FieldStatus; error?: string }) {
  if (status === "saving") return <span className="text-xs text-neutral-400">Guardando…</span>;
  if (status === "saved") return <span className="text-xs text-emerald-600 dark:text-emerald-400">Guardado ✓</span>;
  if (status === "error") return <span className="text-xs text-red-600 dark:text-red-400">{error || "Error — reintenta"}</span>;
  return null;
}

/** Contactos de la ficha, editables — pensado para el Verificador y Editar data, no la vista pública. */
export function ProjectContactsEditor({
  projectId,
  initialContacts,
}: {
  projectId: string;
  initialContacts: ProjectStakeholder[];
}) {
  const [contacts, setContacts] = useState<EditableContact[]>(initialContacts.map(toEditable));
  const [status, setStatus] = useState<Record<string, Partial<Record<ContactField, FieldStatus>>>>({});
  const [errors, setErrors] = useState<Record<string, Partial<Record<ContactField, string>>>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function updateLocal(personId: string, field: ContactField, value: string) {
    setContacts((prev) => prev.map((c) => (c.personId === personId ? { ...c, [field]: value } : c)));
  }

  async function saveField(personId: string, field: ContactField, rawValue: string) {
    setStatus((prev) => ({ ...prev, [personId]: { ...prev[personId], [field]: "saving" } }));
    const value = rawValue.trim() === "" ? null : rawValue.trim();
    const result = await updateContactField(projectId, personId, field, value);
    setStatus((prev) => ({ ...prev, [personId]: { ...prev[personId], [field]: result.success ? "saved" : "error" } }));
    setErrors((prev) => ({ ...prev, [personId]: { ...prev[personId], [field]: result.success ? undefined : result.error } }));
  }

  async function handleRemove(personId: string) {
    setRemovingId(personId);
    const result = await removeProjectContact(projectId, personId);
    if (result.success) {
      setContacts((prev) => prev.filter((c) => c.personId !== personId));
    }
    setRemovingId(null);
  }

  async function handleAdd() {
    if (!newName.trim()) {
      setAddError("El nombre es obligatorio.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const result = await addProjectContact(projectId, newName, newEmail, newPhone);
    setAdding(false);
    if (result.success && result.personId) {
      setContacts((prev) => [
        ...prev,
        { personId: result.personId!, name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim() },
      ]);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
    } else {
      setAddError(result.error ?? "No se pudo agregar el contacto.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">Contactos</h2>

      {contacts.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin contactos registrados todavía.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {contacts.map((c) => (
          <div key={c.personId} className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-1 flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Nombre</span>
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => updateLocal(c.personId, "name", e.target.value)}
                  onBlur={(e) => saveField(c.personId, "name", e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
                />
                <FieldHint status={status[c.personId]?.name} error={errors[c.personId]?.name} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Email</span>
                <input
                  type="text"
                  value={c.email}
                  onChange={(e) => updateLocal(c.personId, "email", e.target.value)}
                  onBlur={(e) => saveField(c.personId, "email", e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
                />
                <FieldHint status={status[c.personId]?.email} error={errors[c.personId]?.email} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Teléfono</span>
                <input
                  type="text"
                  value={c.phone}
                  onChange={(e) => updateLocal(c.personId, "phone", e.target.value)}
                  onBlur={(e) => saveField(c.personId, "phone", e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
                />
                <FieldHint status={status[c.personId]?.phone} error={errors[c.personId]?.phone} />
              </label>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(c.personId)}
              disabled={removingId === c.personId}
              className="text-xs font-medium text-red-600 underline underline-offset-2 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
            >
              {removingId === c.personId ? "Quitando…" : "Quitar"}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Agregar contacto</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Nombre"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
          />
          <input
            type="text"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
          />
          <input
            type="text"
            placeholder="Teléfono"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="mt-2 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {adding ? "Agregando…" : "Agregar"}
        </button>
        {addError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{addError}</p>}
      </div>
    </div>
  );
}
