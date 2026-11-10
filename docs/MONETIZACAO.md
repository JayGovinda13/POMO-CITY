# Monetização: AdSense e doações

Tudo é **opcional e configurado por variáveis de ambiente**. Sem elas, nenhum anúncio é
carregado e o botão de doação não aparece em produção (em desenvolvimento aparecem marcadores
mostrando onde ficarão).

## Onde aparecem

| Item | Onde |
|------|------|
| Anúncio (AdSense) | Tela inicial, abaixo dos botões · Jornal da cidade (fim de cada ciclo), na lateral |
| Botão 💝 Apoiar | Tela inicial · Barra superior do jogo |
| Política de privacidade | `/privacidade` (link na tela inicial) |

Os anúncios ficam **fora da área de jogo e longe dos botões** (regra do AdSense contra cliques
acidentais) e **nunca durante o foco**: o jornal só aparece quando o ciclo termina.

## Google AdSense

1. Crie a conta em [adsense.google.com](https://adsense.google.com) e adicione o domínio do jogo.
2. Configure as variáveis (Vercel → Project → Settings → Environment Variables, ou `.env.local`):
   - `NEXT_PUBLIC_ADSENSE_CLIENT` = seu ID de editor, `ca-pub-XXXXXXXXXXXXXXXX`.
3. Faça um deploy. O jogo passa a publicar automaticamente:
   - a meta tag `google-adsense-account` (verificação do site);
   - o arquivo **`/ads.txt`**;
   - o script do AdSense.
4. No AdSense, verifique o site e aguarde a aprovação.
5. Depois de aprovado, crie **2 blocos de anúncio** (Display, responsivo) e configure:
   - `NEXT_PUBLIC_ADSENSE_SLOT_TITLE`, para a tela inicial;
   - `NEXT_PUBLIC_ADSENSE_SLOT_NEWSPAPER`, para o jornal.
6. **Consentimento (LGPD/GDPR):** em AdSense → *Privacidade e mensagens*, ative a mensagem de
   consentimento do Google (CMP certificada). Ela é obrigatória para visitantes do Espaço Econômico
   Europeu e do Reino Unido.

**Aprovação:** o AdSense revisa o conteúdo do site. Como o jogo é desenhado no navegador, ajuda
ter páginas com texto renderizado no servidor, como `/privacidade` e, no futuro, as páginas
públicas das cidades e da galeria (previstas no roadmap).

## Doações

Duas formas, que podem ser usadas juntas. Nenhuma passa dinheiro pelo servidor do jogo.

### Pix (recomendado no Brasil)

O jogo gera o **Pix copia e cola** e o **QR Code** no próprio navegador (padrão BR Code do Banco
Central), com valores sugeridos (R$ 5, 10, 25, 50) ou um valor livre. O dinheiro cai direto na
sua conta, sem taxa de intermediário.

1. No app do seu banco, crie uma **chave Pix aleatória**. Não use CPF, telefone ou e-mail: a chave
   fica visível para quem doa.
2. Configure as variáveis:
   - `NEXT_PUBLIC_PIX_KEY` = a chave aleatória;
   - `NEXT_PUBLIC_PIX_NAME` = seu nome como aparece no banco (até 25 letras);
   - `NEXT_PUBLIC_PIX_CITY` = sua cidade (até 15 letras).
3. Faça um deploy e teste pagando R$ 1 com outro aparelho.

As doações chegam com o identificador `POMOCITY` (campo *txid*), o que ajuda a separá-las no extrato.

### Cartão e doações internacionais

Use um link público de doação em `NEXT_PUBLIC_DONATE_URL`.

**Recomendado: Stripe Payment Link.**
- Crie a conta em [stripe.com](https://stripe.com).
- Vá em *Payment Links → Criar*, escolha um produto "Doação ao POMO-CITY" e marque **"Permitir que
  o cliente escolha o valor"**.
- Copie o link `https://buy.stripe.com/...` para a variável.
- Aceita cartão do mundo todo e, no Brasil, também Pix e boleto, se você ativar.

**Alternativas** que também funcionam como link:
- **Apoia.se** ou **Catarse**: apoio mensal, popular no Brasil;
- **Ko-fi**;
- **GitHub Sponsors**.

### Boas práticas

- **Doação não dá vantagem no jogo.** O foco é o único combustível da cidade, e é isso que
  dá sentido ao POMO-CITY. Uma ideia futura é dar um selo ou cosmético de "Apoiador", só
  visual.
- **Transparência:** vale publicar de vez em quando quanto entrou e para onde foi
  (servidor, domínio, arte).
- **Impostos:** doações recebidas como pessoa física podem precisar ser declaradas
  (e as do exterior, recolhidas pelo carnê-leão). Confirme com um contador.
