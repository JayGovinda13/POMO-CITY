"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_MUSIC, loadMusicSettings, music, saveMusicSettings, type MusicChoice, type MusicSettings } from "@/audio/player";
import { GENRES, TRACKS, TRACK_IDS, tracksOf, type GenreId, type TrackId } from "@/audio/tracks";
import { useGame } from "@/store/game";
import { MusicDoubleNote, SoundOff } from "./icons";

// Configurações da música compartilhadas entre o controlador e o botão.
let settings: MusicSettings = DEFAULT_MUSIC;
const subs = new Set<() => void>();
function setSettings(next: Partial<MusicSettings>) {
  settings = { ...settings, ...next };
  saveMusicSettings(settings);
  subs.forEach((f) => f());
}
const useSettings = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => settings,
    () => DEFAULT_MUSIC,
  );

function useCurrentTrack() {
  return useSyncExternalStore(
    (f) => music.onTrack(f),
    () => music.current,
    () => null,
  );
}

/** Toca o sino do fim do ciclo (se o jogador não desligou). */
export function ringBell(kind: "focus" | "break") {
  if (settings.bell) music.bell(kind);
}

/**
 * Liga a música no primeiro clique/tecla (o navegador só deixa tocar som depois de um gesto)
 * e abaixa durante o foco, se o jogador pediu.
 */
export function MusicController() {
  const phase = useGame((s) => s.phase);
  const s = useSettings();

  useEffect(() => {
    settings = loadMusicSettings();
    music.choice = settings.choice;
    music.setVolume(settings.volume);
    subs.forEach((f) => f());
    const unlock = () => music.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    music.setVolume(s.volume);
    music.setChoice(s.choice);
  }, [s.choice, s.volume]);

  useEffect(() => {
    music.setDucked(s.muteInFocus && phase === "focus");
  }, [s.muteInFocus, phase]);

  return null;
}

const CHOICES: { id: MusicChoice; label: string; hint: string }[] = [
  { id: "radio", label: "📻 Rádio", hint: `Todas as ${TRACK_IDS.length} faixas em ordem aleatória` },
  ...GENRES.map((g) => ({ id: g.id as MusicChoice, label: g.name, hint: `As 8 faixas de ${g.name} em sequência` })),
  { id: "off", label: "🔇 Desligada", hint: "Sem música" },
];

/** Gênero a mostrar na lista de faixas: o escolhido, o da faixa escolhida ou o que está tocando. */
function genreShown(choice: MusicChoice, current: TrackId | null): GenreId | null {
  if (choice in TRACKS) return TRACKS[choice as TrackId].genre;
  if (GENRES.some((g) => g.id === choice)) return choice as GenreId;
  return current ? TRACKS[current].genre : null;
}

/** Botão 🎵 com a escolha da trilha, volume e silêncio durante o foco. */
export function MusicButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [open, setOpen] = useState(false);
  const s = useSettings();
  const current = useCurrentTrack();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const playing = current ? `${TRACKS[current].name} — ${TRACKS[current].title}` : "Música desligada";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`retro-button ${variant === "full" ? "w-full py-1" : ""}`}
        title={playing}
        aria-label="Música"
        onClick={() => setOpen((o) => !o)}
      >
        {s.choice === "off" ? <SoundOff /> : <MusicDoubleNote />}
        {variant === "full" && ` ${playing}`}
      </button>
      {open && (
        <div className="retro-panel absolute right-0 top-full z-50 mt-1 w-64 space-y-2 p-2 text-xs">
          <h3 className="text-[10px] uppercase tracking-wider text-zinc-400">Trilha sonora 16 bits</h3>
          <div className="grid grid-cols-2 gap-1">
            {CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.hint}
                className={`retro-button ${s.choice === c.id || (c.id !== "radio" && c.id !== "off" && s.choice in TRACKS && TRACKS[s.choice as TrackId].genre === c.id) ? "retro-button-active" : ""}`}
                onClick={() => {
                  setSettings({ choice: c.id });
                  music.unlock();
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          {current && (
            <p className="text-amber-300">
              ♪ {TRACKS[current].title} <span className="text-zinc-400">({TRACKS[current].name})</span>
            </p>
          )}
          {(() => {
            const g = genreShown(s.choice, current);
            if (!g) return null;
            return (
              <div>
                <h4 className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">
                  Faixas · {GENRES.find((x) => x.id === g)!.name}
                </h4>
                <ol className="max-h-44 space-y-0.5 overflow-y-auto">
                  {tracksOf(g).map((id, k) => (
                    <li key={id}>
                      <button
                        type="button"
                        className={`w-full px-1 text-left hover:bg-zinc-700 ${s.choice === id ? "bg-zinc-700 text-amber-300" : current === id ? "text-amber-300" : ""}`}
                        title={s.choice === id ? "Repetindo esta faixa" : "Tocar e repetir esta faixa"}
                        onClick={() => {
                          setSettings({ choice: id });
                          music.unlock();
                        }}
                      >
                        {k + 1}. {TRACKS[id].title}
                        {s.choice === id && " 🔁"}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })()}
          <label className="flex items-center gap-2">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(s.volume * 100)}
              onChange={(e) => setSettings({ volume: Number(e.target.value) / 100 })}
              className="flex-1"
              aria-label="Volume da música"
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.muteInFocus} onChange={(e) => setSettings({ muteInFocus: e.target.checked })} />
            Silenciar durante o foco
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.bell}
              onChange={(e) => {
                setSettings({ bell: e.target.checked });
                if (e.target.checked) music.bell("break"); // prévia do som
              }}
            />
            Sino ao fim do foco e da pausa
          </label>
        </div>
      )}
    </div>
  );
}
