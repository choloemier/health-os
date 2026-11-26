"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, ShieldCheck, ArrowRight } from "lucide-react";
import { triggerLightHaptic } from "@/lib/sound-haptics";

export default function UnlockPage() {
  const router = useRouter();
  const [pin, setPin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const submitPin = useCallback(
    async (candidatePin: string) => {
      if (!candidatePin || loading) return;
      setLoading(true);
      setFeedback(null);

      try {
        const res = await fetch("/api/auth/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: candidatePin }),
        });

        if (res.ok) {
          router.replace("/");
          router.refresh();
          return;
        }

        const data = await res.json().catch(() => ({}));
        setFeedback(data.error || "PIN no coincide. Verifica tu código.");
        setPin("");
      } catch {
        setFeedback("Error de conexión local. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    },
    [loading, router]
  );

  const handleDigit = useCallback(
    (d: string) => {
      if (loading) return;
      triggerLightHaptic();
      setFeedback(null);
      setPin((prev) => (prev.length < 8 ? prev + d : prev));
    },
    [loading]
  );

  const handleBackspace = useCallback(() => {
    triggerLightHaptic();
    setPin((prev) => prev.slice(0, -1));
  }, []);

  // Soporte completo para teclado numérico físico en PC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter" && pin.length >= 4) {
        submitPin(pin);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pin, handleDigit, handleBackspace, submitPin]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-obsidian-950 px-6 py-10 text-zinc-100">
      <div className="w-full max-w-sm rounded-3xl border border-obsidian-800 bg-obsidian-900 p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-400 border border-lime-400/30">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-white">
            HEALTH OS
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Ingresa tu PIN numérico personal (sesión activa por 90 días)
          </p>
        </div>

        {/* Visor de puntos del PIN */}
        <div className="mt-6 flex h-14 items-center justify-center gap-3 rounded-2xl border border-obsidian-800 bg-obsidian-950 px-4">
          {pin.length === 0 ? (
            <span className="font-mono text-xs tracking-widest text-zinc-600">
              • • • •
            </span>
          ) : (
            Array.from({ length: pin.length }).map((_, i) => (
              <span
                key={i}
                className="h-3.5 w-3.5 rounded-full bg-lime-400 transition-transform"
              />
            ))
          )}
        </div>

        {feedback && (
          <p className="mt-3 text-center text-xs font-medium text-amber-300">
            {feedback}
          </p>
        )}

        {/* Teclado Táctil Grande de 1 Mano */}
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="flex h-14 items-center justify-center rounded-2xl border border-obsidian-800 bg-obsidian-950 font-mono text-xl font-bold text-white transition hover:border-obsidian-700 active:scale-95 active:bg-obsidian-800"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Borrar dígito"
            className="flex h-14 items-center justify-center rounded-2xl border border-obsidian-800 bg-obsidian-950 text-zinc-400 active:scale-95"
          >
            <Delete className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="flex h-14 items-center justify-center rounded-2xl border border-obsidian-800 bg-obsidian-950 font-mono text-xl font-bold text-white active:scale-95 active:bg-obsidian-800"
          >
            0
          </button>

          <button
            type="button"
            disabled={pin.length < 4 || loading}
            onClick={() => submitPin(pin)}
            aria-label="Entrar"
            className="flex h-14 items-center justify-center rounded-2xl bg-lime-400 font-bold text-obsidian-950 transition active:scale-95 disabled:opacity-35"
          >
            <ArrowRight className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
