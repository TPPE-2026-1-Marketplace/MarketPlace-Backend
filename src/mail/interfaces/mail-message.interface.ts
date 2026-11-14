/** Mensagem pronta para envio: texto puro e HTML com o mesmo conteúdo. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Transporte em uso: SMTP, API do Gmail via HTTPS ou nenhum (envio desabilitado). */
export type MailTransportMode = 'smtp' | 'gmail-api' | 'disabled';
