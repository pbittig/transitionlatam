"use client";

import { Fragment, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, LockKeyhole, Send, Sparkles, Trash2, X } from "lucide-react";
import { clearTransitionAiHistory } from "../aiActions";
import type { AiChatMemoryMessage } from "@/lib/data-access/aiChat";

function renderChatText(content: string) {
  const boldSplit = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return <Fragment key={index}>{part}</Fragment>;
    });

  const blocks = content.split(/\n{2,}/);
  return blocks.map((block, blockIndex) => {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    const isList = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line.trim()));
    if (isList) {
      return (
        <ul key={blockIndex} className="list-disc space-y-1 pl-4">
          {lines.map((line, lineIndex) => (
            <li key={lineIndex}>{boldSplit(line.trim().replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={blockIndex}>
        {lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            {boldSplit(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}

export function PremiumAiBar({ enabled, initialMessages = [] }: { enabled: boolean; initialMessages?: AiChatMemoryMessage[] }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [clearPending, startClearTransition] = useTransition();

  async function sendQuestion() {
    const value = question.trim();
    if (!value || pending) return;
    const previous = messages;
    const assistantIndex = previous.length + 1;
    setMessages([...previous, { role: "user", content: value }, { role: "assistant", content: "" }]);
    setQuestion("");
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/transition-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: previous, question: value }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "No pudimos consultar Transition AI.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value: chunk, done } = await reader.read();
        buffer += decoder.decode(chunk, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as {
            type: "delta" | "done";
            content?: string;
            remainingTokens?: number | null;
          };
          if (event.type === "delta" && event.content) {
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex ? { ...message, content: message.content + event.content } : message,
              ),
            );
          } else if (event.type === "done") {
            setRemaining(event.remainingTokens ?? null);
          }
        }
        if (done) break;
      }
    } catch (err) {
      setMessages((current) => current.filter((_, index) => index !== assistantIndex));
      setError(err instanceof Error ? err.message : "No pudimos consultar Transition AI.");
    } finally {
      setPending(false);
    }
  }

  function clearHistory() {
    startClearTransition(async () => {
      const result = await clearTransitionAiHistory();
      if (result.success) {
        setMessages([]);
        setRemaining(null);
        setError(null);
      }
    });
  }

  return (
    <aside className="relative">
      {open && (
        <div className="mb-3 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-brand-primary/35 bg-white/97 shadow-2xl shadow-brand-deep/20 backdrop-blur-xl dark:bg-neutral-950/97">
          <div className="flex items-center justify-between border-b border-brand-primary/20 bg-gradient-to-r from-brand-ink to-brand-deep px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary shadow-sm">
                <Image src="/iso-blanco.png" alt="" width={44} height={44} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Transition AI</p>
                <p className="text-[10px] text-white/65">Consulta la información de la plataforma</p>
              </div>
            </div>
            <div className="flex items-center">
              {enabled && messages.length > 0 && (
                <button type="button" onClick={clearHistory} disabled={pending || clearPending} title="Borrar historial y comenzar de nuevo" aria-label="Borrar historial" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white">
                  <Trash2 size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar Transition AI"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {enabled ? (
            <div className="p-4">
              {messages.length === 0 && <div className="rounded-xl border border-brand-primary/20 bg-brand-surface p-3 dark:bg-brand-primary/10">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-deep dark:text-brand-primary">
                  <Sparkles size={13} /> Transition AI operativo
                </div>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Pregunta por conceptos del mercado, prepara análisis y estructura reportes. La conexión directa con datos de proyectos se incorporará progresivamente.
                </p>
              </div>}
              {messages.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {messages.map((message, index) => (
                    <div key={index} className={`space-y-2 rounded-xl px-3 py-2 text-xs leading-5 ${message.role === "user" ? "ml-8 bg-brand-deep text-white" : "mr-5 bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"}`}>
                      {message.role === "assistant" ? renderChatText(message.content) : message.content}
                    </div>
                  ))}
                  {pending && messages.at(-1)?.content === "" && <p className="text-xs text-neutral-400">Transition AI está pensando…</p>}
                </div>
              )}
              <div className="mt-3 flex gap-2 overflow-hidden">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-surface px-2.5 py-1.5 text-[10px] font-medium text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
                  <Sparkles size={11} /> Analizar proyectos
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                  <FileText size={11} /> Crear reporte
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1.5 text-[10px] font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <BarChart3 size={11} /> Comparar
                </span>
              </div>
              <form action={sendQuestion} className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
                <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2500} placeholder="Pregunta sobre energía o mercado…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400" />
                <button
                  type="submit"
                  disabled={pending || !question.trim()}
                  aria-label="Enviar pregunta"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-neutral-950 disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </form>
              {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
              <p className="mt-2 text-center text-[10px] text-neutral-400">{remaining === null ? "Memoria de 7 días · Kimi K3 · verifica información crítica" : `${remaining.toLocaleString("es-CL")} tokens disponibles este mes`}</p>
            </div>
          ) : (
            <div className="p-5 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
                <LockKeyhole size={19} />
              </span>
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Transition AI estará disponible en Premium</p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Haz preguntas sobre la información, compara proyectos y prepara reportes desde la plataforma.
              </p>
              <Link
                href="/planes"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink dark:bg-brand-primary dark:text-neutral-950"
              >
                Conocer Premium <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Cerrar Transition AI" : "Abrir Transition AI"}
        className="ml-auto flex items-center gap-2 rounded-2xl border border-brand-primary/45 bg-white px-2.5 py-2 shadow-xl shadow-brand-deep/20 transition hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-2xl dark:bg-neutral-950"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary">
          <Image src="/iso-blanco.png" alt="" width={44} height={44} className="h-5 w-5" />
        </span>
        <span className="pr-1 text-left">
          <span className="block text-xs font-semibold text-brand-ink dark:text-white">Chat con Transition AI</span>
          <span className="block text-[9px] font-medium text-brand-deep dark:text-brand-primary">
            {enabled ? "Kimi K3 · activo" : "Disponible con Premium"}
          </span>
        </span>
        {!enabled && <LockKeyhole size={13} className="mr-1 text-neutral-400" />}
      </button>
    </aside>
  );
}
