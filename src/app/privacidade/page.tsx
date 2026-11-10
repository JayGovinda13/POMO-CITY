import type { Metadata } from "next";
import Link from "next/link";
import { adsEnabled } from "@/lib/ads";

export const metadata: Metadata = {
  title: "Privacidade · POMO-CITY",
  description: "Como o POMO-CITY trata seus dados, cookies e anúncios.",
};

/** Política de privacidade (exigida pelo AdSense; renderizada no servidor). */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 text-sm leading-relaxed">
      <h1 className="text-xl font-bold text-amber-300">Política de privacidade</h1>
      <p>
        O POMO-CITY é um jogo de construção de cidades movido a ciclos de foco (Pomodoro). Esta página explica quais dados
        usamos e por quê.
      </p>
      <h2 className="font-bold">Dados do jogo</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Guardamos o estado da sua cidade e o histórico dos seus ciclos de foco para validar o progresso e evitar trapaças.</li>
        <li>Você joga como convidado (conta anônima). Se vincular um e-mail, ele serve só para entrar na sua conta.</li>
        <li>
          A localização do navegador, se você permitir, é usada apenas no seu aparelho para escolher a região climática. Só o
          identificador da região é enviado; nunca suas coordenadas.
        </li>
        <li>Preferências locais (como o tutorial já visto) ficam no armazenamento do seu navegador.</li>
      </ul>
      <h2 className="font-bold">Anúncios e cookies</h2>
      <p>
        {adsEnabled ? "Exibimos" : "Podemos exibir"} anúncios do Google AdSense. O Google e seus parceiros usam cookies para
        exibir anúncios com base nas suas visitas a este e a outros sites. Você pode desativar a publicidade personalizada nas{" "}
        <a className="underline" href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
          Configurações de anúncios do Google
        </a>{" "}
        e saber mais em{" "}
        <a className="underline" href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">
          policies.google.com/technologies/ads
        </a>
        .
      </p>
      <h2 className="font-bold">Doações</h2>
      <p>
        Doações por Pix são feitas no app do seu banco e por cartão na plataforma de pagamento escolhida; o POMO-CITY não recebe
        nem armazena dados de pagamento. Doações não dão vantagem no jogo.
      </p>
      <h2 className="font-bold">Créditos</h2>
      <p>
        Ícones de{" "}
        <a className="underline" href="https://game-icons.net" target="_blank" rel="noopener noreferrer">
          game-icons.net
        </a>{" "}
        (Lorc, Delapouite e colaboradores), sob a licença{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">
          CC BY 3.0
        </a>
        . Músicas e sprites originais do POMO-CITY.
      </p>
      <h2 className="font-bold">Seus direitos (LGPD)</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados pelo contato informado na página do projeto. Ao apagar a
        conta, a cidade e o histórico de ciclos são removidos.
      </p>
      <p>
        <Link className="underline" href="/">
          ← Voltar ao jogo
        </Link>
      </p>
    </main>
  );
}
