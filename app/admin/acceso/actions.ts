"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth/session";

export interface AdminAccessState {
  error?: string;
}

function safelyMatches(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export async function accessAdmin(
  _previousState: AdminAccessState | undefined,
  formData: FormData,
): Promise<AdminAccessState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const configuredUsername = process.env.ADMIN_PORTAL_USERNAME ?? process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PORTAL_PASSWORD ?? process.env.ADMIN_PASSWORD;

  if (
    !configuredUsername ||
    !configuredPassword ||
    !safelyMatches(username, configuredUsername) ||
    !safelyMatches(password, configuredPassword)
  ) {
    return { error: "Usuario o clave incorrectos." };
  }

  await createSession(username);
  redirect("/admin");
}
