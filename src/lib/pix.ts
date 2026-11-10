// Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central). Gerado no próprio
// navegador a partir da chave Pix: o dinheiro vai direto para a conta do dono da chave.

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC16-CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), exigido pelo BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Nome e cidade no BR Code: sem acentos, maiúsculas e com tamanho máximo. */
const clean = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max);

export interface PixOptions {
  key: string;
  name: string;
  city: string;
  /** Valor em reais (opcional: sem valor, quem paga escolhe). */
  amount?: number;
  /** Identificador da doação (até 25 caracteres alfanuméricos; "***" = sem identificador). */
  txid?: string;
  description?: string;
}

export function pixPayload({ key, name, city, amount, txid = "***", description }: PixOptions): string {
  const account = field("00", "br.gov.bcb.pix") + field("01", key.trim()) + (description ? field("02", description.slice(0, 40)) : "");
  const body =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (amount && amount > 0 ? field("54", amount.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", clean(name, 25) || "POMO CITY") +
    field("60", clean(city, 15) || "BRASIL") +
    field("62", field("05", txid.replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***")) +
    "6304";
  return body + crc16(body);
}
