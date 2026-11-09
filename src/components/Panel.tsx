import type { ReactNode } from "react";

/** Janela retrô estilo anos 90 (bordas biseladas). */
export function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`retro-panel pointer-events-auto ${className}`}>
      <header className="retro-title">{title}</header>
      <div className="p-2">{children}</div>
    </section>
  );
}
