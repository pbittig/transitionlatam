"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { confirmPrimeInterest, type PrimeInterestState } from "./actions";
import type { AppLocale } from "@/lib/i18n";

const initialState: PrimeInterestState = {};

export function PrimeInterestForm({ locale }: { locale: AppLocale }) {
  const [state, formAction, pending] = useActionState(confirmPrimeInterest, initialState);

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={34} strokeWidth={1.8} />
        <h2 className="mt-4 text-xl font-semibold text-neutral-950">
          {locale === "en" ? "Your interest in Prime has been confirmed" : "Su interés en Prime quedó confirmado"}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-600">
          {locale === "en"
            ? "We will contact you directly to send the service agreement and the secure payment link."
            : "Lo contactaremos directamente para enviarle el contrato de servicio y el enlace seguro de pago."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      {state.error && <p className="mb-3 text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-[#333333] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <Send size={16} />
        {pending
          ? (locale === "en" ? "Confirming..." : "Confirmando...")
          : (locale === "en" ? "Confirm interest in Prime" : "Confirmar interés en contratar Prime")}
      </button>
    </form>
  );
}
