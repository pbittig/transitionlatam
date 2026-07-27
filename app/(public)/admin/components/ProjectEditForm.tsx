"use client";

import { useState } from "react";
import { updateProjectField, updateProjectTechnologyCombo, type EditableProjectField } from "../projectEditActions";
import type { ProjectDetail } from "@/lib/data-access/projects";
import { TECHNOLOGY_COMBOS, TECHNOLOGY_COMBO_ORDER, comboFromProject, type TechnologyCombo } from "../technologyCombos";

type FieldStatus = "idle" | "saving" | "saved" | "error";

const TEXT_FIELDS: Array<{ key: EditableProjectField; label: string }> = [
  { key: "name", label: "Nombre" },
  { key: "developerCompanyRut", label: "RUT" },
  { key: "developerCompanyAddress", label: "Dirección legal" },
  { key: "spvName", label: "SPV" },
  { key: "connectionPoint", label: "Punto de conexión" },
  { key: "voltageLevel", label: "Nivel de tensión (kV)" },
  { key: "nup", label: "NUP" },
];

/** Siempre visible — es el MW principal para los proyectos que no incluyen almacenamiento (la mayoría). */
const CAPACITY_FIELD: { key: EditableProjectField; label: string } = { key: "capacityMw", label: "Capacidad (MW)" };

/** Solo tiene sentido cuando el proyecto incluye almacenamiento — mismo criterio que la ficha pública (`app/(public)/proyectos/[id]/page.tsx`). */
const STORAGE_NUMBER_FIELDS: Array<{ key: EditableProjectField; label: string }> = [
  { key: "storageCapacityMw", label: "Potencia de almacenamiento (MW)" },
  { key: "capacityMwh", label: "Energía (MWh)" },
  { key: "storageHours", label: "Horas de almacenamiento" },
];

/** Un BESS puro (project_kind = "storage") no tiene componente de generación — mostrar este campo ahí siempre queda vacío e irrelevante. */
const GENERATION_FIELD: { key: EditableProjectField; label: string } = {
  key: "generationCapacityMw",
  label: "Potencia de generación (MW)",
};

const REQUEST_TYPE_OPTIONS = ["SAC", "SUCTD", "FEHACIENTE"];

function toNullableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toNullableText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function fieldValues(project: ProjectDetail): Record<EditableProjectField, string> {
  return {
    name: project.name,
    capacityMw: project.capacityMw !== null ? String(project.capacityMw) : "",
    capacityMwh: project.capacityMwh !== null ? String(project.capacityMwh) : "",
    generationCapacityMw: project.generationCapacityMw !== null ? String(project.generationCapacityMw) : "",
    storageCapacityMw: project.storageCapacityMw !== null ? String(project.storageCapacityMw) : "",
    storageHours: project.storageHours !== null ? String(project.storageHours) : "",
    status: project.status ?? "",
    estimatedConnectionDate: project.estimatedConnectionDate ?? "",
    nup: project.nup ?? "",
    developerCompanyRut: project.developerCompanyRut ?? "",
    developerCompanyAddress: project.developerCompanyAddress ?? "",
    spvName: project.spv ?? "",
    connectionPoint: project.connectionPoint ?? "",
    voltageLevel: project.voltageLevel ?? "",
    requestType: project.requestType ?? "",
  };
}

function StatusHint({ status, errorMessage }: { status?: FieldStatus; errorMessage?: string }) {
  if (status === "saving") return <span className="text-xs text-neutral-400">Guardando…</span>;
  if (status === "saved") return <span className="text-xs text-emerald-600 dark:text-emerald-400">Guardado ✓</span>;
  if (status === "error")
    return <span className="text-xs text-red-600 dark:text-red-400">{errorMessage || "Error — reintenta"}</span>;
  return null;
}

export function ProjectEditForm({
  project,
  connectionStatusOptions,
}: {
  project: ProjectDetail;
  connectionStatusOptions: string[];
}) {
  const [values, setValues] = useState(fieldValues(project));
  const [status, setStatus] = useState<Partial<Record<EditableProjectField, FieldStatus>>>({});
  const [errorMessages, setErrorMessages] = useState<Partial<Record<EditableProjectField, string>>>({});

  const [combo, setCombo] = useState<TechnologyCombo | "">(
    comboFromProject(project.technologyCode, project.includesStorage) ?? "",
  );
  const [comboStatus, setComboStatus] = useState<FieldStatus>("idle");
  const [comboError, setComboError] = useState<string | undefined>();

  // Mientras no se elija un combo (proyecto con tecnología fuera de solar/eólico/BESS/híbrido,
  // o híbrido+storage que no se puede reconstruir con certeza), las celdas siguen el estado
  // real del proyecto — ver comboFromProject en ../technologyCombos.
  const includesStorage = combo ? TECHNOLOGY_COMBOS[combo].includesStorage : project.includesStorage;
  const projectKind = combo ? TECHNOLOGY_COMBOS[combo].projectKind : project.projectKind;

  async function save(field: EditableProjectField, value: string | number | null) {
    setStatus((prev) => ({ ...prev, [field]: "saving" }));
    try {
      const result = await updateProjectField(project.id, field, value);
      setStatus((prev) => ({ ...prev, [field]: result.success ? "saved" : "error" }));
      setErrorMessages((prev) => ({ ...prev, [field]: result.success ? undefined : result.error }));
    } catch (err) {
      setStatus((prev) => ({ ...prev, [field]: "error" }));
      setErrorMessages((prev) => ({ ...prev, [field]: (err as Error).message }));
    }
  }

  async function saveTechnologyCombo(newCombo: TechnologyCombo) {
    setCombo(newCombo); // activa las celdas al toque, sin esperar el guardado
    setComboStatus("saving");
    try {
      const result = await updateProjectTechnologyCombo(project.id, newCombo);
      setComboStatus(result.success ? "saved" : "error");
      setComboError(result.success ? undefined : result.error);
    } catch (err) {
      setComboStatus("error");
      setComboError((err as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
      {TEXT_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
          <input
            type="text"
            value={values[key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={(e) => save(key, toNullableText(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          />
          <StatusHint status={status[key]} errorMessage={errorMessages[key]} />
        </label>
      ))}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Tecnología</span>
        <select
          value={combo}
          onChange={(e) => saveTechnologyCombo(e.target.value as TechnologyCombo)}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          <option value="" disabled>
            — Sin definir —
          </option>
          {TECHNOLOGY_COMBO_ORDER.map((key) => (
            <option key={key} value={key}>
              {TECHNOLOGY_COMBOS[key].label}
            </option>
          ))}
        </select>
        <StatusHint status={comboStatus} errorMessage={comboError} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{CAPACITY_FIELD.label}</span>
        <input
          type="number"
          value={values[CAPACITY_FIELD.key]}
          onChange={(e) => setValues((prev) => ({ ...prev, [CAPACITY_FIELD.key]: e.target.value }))}
          onBlur={(e) => save(CAPACITY_FIELD.key, toNullableNumber(e.target.value))}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
        <StatusHint status={status[CAPACITY_FIELD.key]} errorMessage={errorMessages[CAPACITY_FIELD.key]} />
      </label>

      {includesStorage && projectKind !== "storage" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{GENERATION_FIELD.label}</span>
          <input
            type="number"
            value={values[GENERATION_FIELD.key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [GENERATION_FIELD.key]: e.target.value }))}
            onBlur={(e) => save(GENERATION_FIELD.key, toNullableNumber(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          />
          <StatusHint status={status[GENERATION_FIELD.key]} errorMessage={errorMessages[GENERATION_FIELD.key]} />
        </label>
      )}

      {includesStorage &&
        STORAGE_NUMBER_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
            <input
              type="number"
              value={values[key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              onBlur={(e) => save(key, toNullableNumber(e.target.value))}
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />
            <StatusHint status={status[key]} errorMessage={errorMessages[key]} />
          </label>
        ))}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo de solicitud</span>
        <select
          value={values.requestType}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, requestType: e.target.value }));
            save("requestType", toNullableText(e.target.value));
          }}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          <option value="">— Sin definir —</option>
          {REQUEST_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <StatusHint status={status.requestType} errorMessage={errorMessages.requestType} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Estado</span>
        <select
          value={values.status}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, status: e.target.value }));
            save("status", toNullableText(e.target.value));
          }}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          <option value="">— Sin definir —</option>
          {/* connection_status tiene códigos duplicados con el mismo texto (bug preexistente
              en la ingesta del listado, ver load.ts) — se deduplica por label acá para no
              repetir la misma opción ni colisionar la key de React. */}
          {[...new Set(connectionStatusOptions)].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <StatusHint status={status.status} errorMessage={errorMessages.status} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Fecha estimada de conexión</span>
        <input
          type="date"
          value={values.estimatedConnectionDate}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, estimatedConnectionDate: e.target.value }));
            save("estimatedConnectionDate", toNullableText(e.target.value));
          }}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
        <StatusHint status={status.estimatedConnectionDate} errorMessage={errorMessages.estimatedConnectionDate} />
      </label>
    </div>
  );
}
