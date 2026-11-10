"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { DONATE_URL, PIX, SUGGESTED_AMOUNTS, donationsEnabled, linkEnabled, pixEnabled } from "@/lib/donate";
import { pixPayload } from "@/lib/pix";

/**
 * Botão "Apoiar o POMO-CITY". Doações não dão vantagem no jogo: o foco continua sendo o único
 * combustível da cidade. Sem configuração, em produção o botão não aparece.
 */
export function DonateButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [open, setOpen] = useState(false);
  if (!donationsEnabled && process.env.NODE_ENV === "production") return null;
  return (
    <>
      <button
        type="button"
        className={`retro-button ${variant === "full" ? "w-full py-1" : ""}`}
        onClick={() => setOpen(true)}
        title="Apoiar o POMO-CITY"
        aria-label="Apoiar o POMO-CITY"
      >
        💝{variant === "full" && " Apoiar o POMO-CITY"}
      </button>
      {open && <DonateModal onClose={() => setOpen(false)} />}
    </>
  );
}

function DonateModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(10);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const payload = pixEnabled
    ? pixPayload({ ...PIX, amount: amount ?? undefined, txid: "POMOCITY", description: "Apoio ao POMO-CITY" })
    : "";

  useEffect(() => {
    if (!payload) return;
    let alive = true;
    QRCode.toDataURL(payload, { margin: 1, width: 220, color: { dark: "#1b1630", light: "#ffffff" } })
      .then((url) => alive && setQr(url))
      .catch(() => setQr(null));
    setCopied(false);
    return () => {
      alive = false;
    };
  }, [payload]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 grid place-items-center bg-black/60 p-3">
      <section className="retro-panel max-h-[92dvh] w-full max-w-sm overflow-y-auto text-xs" role="dialog" aria-labelledby="donate-title">
        <header id="donate-title" className="retro-title flex">
          💝 Apoie o POMO-CITY
          <button type="button" className="ml-auto" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="space-y-3 p-3">
          <p>
            O POMO-CITY é feito por uma pessoa só. Se ele te ajuda a focar, uma doação mantém os servidores no ar e o jogo
            evoluindo. <span className="text-zinc-400">Doações não dão vantagem no jogo — aqui, só o foco faz a cidade crescer.</span>
          </p>

          {!donationsEnabled && (
            <p className="border-2 border-dashed border-zinc-600 p-2 text-zinc-400">
              Doações ainda não configuradas. Defina NEXT_PUBLIC_PIX_KEY / NEXT_PUBLIC_PIX_NAME / NEXT_PUBLIC_PIX_CITY e/ou
              NEXT_PUBLIC_DONATE_URL (veja docs/DOACOES.md). Este aviso só aparece em desenvolvimento.
            </p>
          )}

          {pixEnabled && (
            <div className="space-y-2">
              <h3 className="text-zinc-400">Pix (Brasil)</h3>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_AMOUNTS.map((v) => (
                  <button key={v} type="button" className={`retro-button ${amount === v ? "retro-button-active" : ""}`} onClick={() => setAmount(v)}>
                    R$ {v}
                  </button>
                ))}
                <button type="button" className={`retro-button ${amount === null ? "retro-button-active" : ""}`} onClick={() => setAmount(null)}>
                  Outro valor
                </button>
              </div>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR Code Pix para doação" width={220} height={220} className="mx-auto border-4 border-white" style={{ imageRendering: "pixelated" }} />
              )}
              <p className="text-center text-zinc-400">
                Para {PIX.name}
                {amount ? ` · R$ ${amount.toFixed(2).replace(".", ",")}` : " · você escolhe o valor no app do banco"}
              </p>
              <button type="button" className="retro-button retro-button-primary w-full" onClick={copy}>
                {copied ? "✓ Código copiado!" : "Copiar Pix copia e cola"}
              </button>
            </div>
          )}

          {linkEnabled && (
            <div className="space-y-1">
              <h3 className="text-zinc-400">{pixEnabled ? "Cartão ou de fora do Brasil" : "Doar"}</h3>
              <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="retro-button block w-full text-center">
                Doar com cartão ↗
              </a>
            </div>
          )}

          <p className="text-zinc-500">Obrigado! 🍅</p>
        </div>
      </section>
    </div>
  );
}
