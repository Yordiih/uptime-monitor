export interface SendResult {
  ok: boolean;
  error?: string;
  // not attempted because of server configuration or a limit (never retried)
  skipped?: boolean;
  // the user has this channel switched off (not counted as a notification)
  disabled?: boolean;
}
