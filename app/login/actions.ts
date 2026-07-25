"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function login(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword || username !== validUsername || password !== validPassword) {
    return { error: "Usuario o clave incorrectos." };
  }

  await createSession(username);
  redirect("/");
}

export async function logout(): Promise<void> {
  "use server";
  await deleteSession();
  redirect("/login");
}
