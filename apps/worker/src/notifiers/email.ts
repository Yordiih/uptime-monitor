import nodemailer, { type Transporter } from "nodemailer";
import type { SendResult } from "./types";

let transport: Transporter | null | undefined;

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transport = null;
    return null;
  }
  transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  const mailer = getTransport();
  if (!mailer) {
    return { ok: false, skipped: true, error: "email is not configured on this server" };
  }
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM ?? "Uptime Monitor <alerts@localhost>",
      to,
      subject,
      text,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 200) };
  }
}
