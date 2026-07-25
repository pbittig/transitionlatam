"use client";

import { useActionState, useState } from "react";
import type { CurrentUserProfile } from "@/lib/data-access/userProfile";
import { updateProfile, type UpdateProfileState } from "./actions";

const initialState: UpdateProfileState = {};

export function ProfileForm({ profile }: { profile: CurrentUserProfile }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const [preview, setPreview] = useState<string | null>(profile.avatarUrl);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="bg-brand-primary flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white">
            {(profile.fullName ?? profile.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <label htmlFor="avatar" className="cursor-pointer text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-50">
            Cambiar foto
          </label>
          <input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPreview(URL.createObjectURL(file));
            }}
          />
          <p className="text-xs text-neutral-400 dark:text-neutral-500">JPG o PNG, máximo 3 MB.</p>
        </div>
      </div>

      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={profile.fullName ?? ""}
          required
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>

      <div>
        <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Empresa
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          defaultValue={profile.companyName ?? ""}
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
      </div>

      <div>
        <p className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Correo</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{profile.email}</p>
      </div>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600 dark:text-emerald-400">Cambios guardados.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
