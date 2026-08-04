"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, FileText, GitCompareArrows, LockKeyhole, Search, Send, Sparkles, Trash2, X } from "lucide-react";
import { clearTransitionAiHistory } from "../aiActions";
import type { AiChatMemoryMessage } from "@/lib/data-access/aiChat";
import type { AppLocale } from "@/lib/i18n";

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

function NexoOrb({ compact = false }: { compact?: boolean }) {
  const pixels = [
    { row: 1, col: 4, color: "#333333", opacity: 0.72 },
    { row: 2, col: 4, color: "#38D7C5", opacity: 0.55 },
    { row: 3, col: 3, color: "#38D7C5", opacity: 0.72 },
    { row: 3, col: 4, color: "#FFFFFF", opacity: 0.68 },
    { row: 3, col: 5, color: "#38D7C5", opacity: 0.85 },
    { row: 4, col: 1, color: "#333333", opacity: 0.72 },
    { row: 4, col: 2, color: "#38D7C5", opacity: 0.52 },
    { row: 4, col: 3, color: "#38D7C5", opacity: 0.78 },
    { row: 4, col: 4, color: "#FFFFFF", opacity: 1 },
    { row: 4, col: 5, color: "#38D7C5", opacity: 0.7 },
    { row: 4, col: 6, color: "#38D7C5", opacity: 0.95 },
    { row: 4, col: 7, color: "#333333", opacity: 0.72 },
    { row: 5, col: 3, color: "#38D7C5", opacity: 0.58 },
    { row: 5, col: 4, color: "#38D7C5", opacity: 0.76 },
    { row: 5, col: 5, color: "#38D7C5", opacity: 0.92 },
    { row: 6, col: 4, color: "#38D7C5", opacity: 0.56 },
    { row: 7, col: 4, color: "#333333", opacity: 0.72 },
  ];

  return (
    <span className={`nexo-orb relative block shrink-0 overflow-hidden rounded-full ${compact ? "h-9 w-9" : "h-12 w-12"}`} aria-hidden>
      {pixels.map((pixel, index) => (
        <span
          key={`${pixel.row}-${pixel.col}`}
          className="nexo-pixel absolute"
          style={{
            top: `${10 + (pixel.row - 1) * (80 / 7)}%`,
            left: `${10 + (pixel.col - 1) * (80 / 7)}%`,
            width: `${80 / 7}%`,
            height: `${80 / 7}%`,
            backgroundColor: pixel.color,
            opacity: pixel.opacity,
            animationDelay: `${index * -90}ms`,
          }}
        />
      ))}
    </span>
  );
}

export function PremiumAiBar({ enabled, initialMessages = [], locale = "es" }: { enabled: boolean; initialMessages?: AiChatMemoryMessage[]; locale?: AppLocale }) {
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
        throw new Error(payload?.error ?? "No pudimos consultar a Nexo.");
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
      setError(err instanceof Error ? err.message : "No pudimos consultar a Nexo.");
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
        <div className="mb-3 flex h-[min(560px,calc(100dvh-8rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_24px_70px_-24px_rgba(0,0,0,0.28)]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <NexoOrb compact />
              <div>
                <p className="text-sm font-semibold text-neutral-950">Nexo</p>
                <p className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" /> {locale === "en" ? "Platform assistant" : "Asistente de la plataforma"}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              {enabled && messages.length > 0 && (
                <button type="button" onClick={clearHistory} disabled={pending || clearPending} title={locale === "en" ? "Clear history and start again" : "Borrar historial y comenzar de nuevo"} aria-label={locale === "en" ? "Clear history" : "Borrar historial"} className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800">
                  <Trash2 size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={locale === "en" ? "Close Nexo" : "Cerrar Nexo"}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {enabled ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              {messages.length === 0 && <div className="rounded-xl bg-neutral-50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                  <Sparkles size={13} className="text-brand-primary" /> {locale === "en" ? "What do you need to analyze?" : "¿Qué necesitas analizar?"}
                </div>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  {locale === "en" ? "Explore projects, compare market signals or prepare a synthesis." : "Consulte proyectos, compare señales del mercado o prepare una síntesis."}
                </p>
              </div>}
              {messages.length > 0 && (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {messages.map((message, index) => (
                    <div key={index} className={`space-y-2 text-xs leading-5 ${message.role === "user" ? "ml-12 rounded-xl bg-[#333333] px-3 py-2 text-white" : "mr-4 border-l-2 border-brand-primary pl-3 text-neutral-700"}`}>
                      {message.role === "assistant" ? renderChatText(message.content) : message.content}
                    </div>
                  ))}
                  {pending && messages.at(-1)?.content === "" && <p className="text-xs text-neutral-400">{locale === "en" ? "Nexo is thinking…" : "Nexo está pensando…"}</p>}
                </div>
              )}
              {messages.length === 0 && <div className="mt-3 grid gap-1.5">
                {[
                  { icon: Search, label: locale === "en" ? "Identify the projects closest to connection" : "Identifique los proyectos más próximos a conectarse" },
                  { icon: GitCompareArrows, label: locale === "en" ? "Compare two projects" : "Compare dos proyectos" },
                  { icon: FileText, label: locale === "en" ? "Summarize the main risks" : "Resume los principales riesgos" },
                ].map(({ icon: Icon, label }) => (
                  <button key={label} type="button" onClick={() => setQuestion(label)} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-left text-[11px] font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-950">
                    <Icon size={13} className="shrink-0 text-brand-primary" /> {label}
                  </button>
                ))}
              </div>}
              <form action={sendQuestion} className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 focus-within:border-[#333333]">
                <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2500} placeholder={locale === "en" ? "Ask about energy or the market…" : "Pregunta sobre energía o mercado…"} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400" />
                <button
                  type="submit"
                  disabled={pending || !question.trim()}
                  aria-label={locale === "en" ? "Send question" : "Enviar pregunta"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-neutral-950 disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </form>
              {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
              {remaining !== null && <p className="mt-2 text-center text-[10px] text-neutral-400">{remaining.toLocaleString(locale === "en" ? "en-US" : "es-CL")} {locale === "en" ? "tokens available this month" : "tokens disponibles este mes"}</p>}
            </div>
          ) : (
            <div className="p-5 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
                <LockKeyhole size={19} />
              </span>
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{locale === "en" ? "Nexo is available on Prime" : "Nexo estará disponible en Prime"}</p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {locale === "en" ? "Ask questions about the data, compare projects and prepare reports from the platform." : "Realice consultas sobre la información, compare proyectos y prepare reportes desde la plataforma."}
              </p>
              <Link
                href="/planes"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-[#333333] transition hover:brightness-95"
              >
                {locale === "en" ? "Explore Prime" : "Conocer Prime"} <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? (locale === "en" ? "Close Nexo" : "Cerrar Nexo") : (locale === "en" ? "Chat with Nexo" : "Chatea con Nexo")}
        title={open ? (locale === "en" ? "Close Nexo" : "Cerrar Nexo") : (locale === "en" ? "Chat with Nexo" : "Chatea con Nexo")}
        className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        {open ? <X size={20} className="text-[#333333]" /> : <NexoOrb />}
        {!enabled && <LockKeyhole size={11} className="absolute -top-0.5 -right-0.5 rounded-full bg-white p-0.5 text-[#333333]" />}
      </button>
    </aside>
  );
}
