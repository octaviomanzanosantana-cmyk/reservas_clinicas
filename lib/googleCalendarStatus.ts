export type GoogleCalendarStatus = {
  connected?: boolean;
  authorized?: boolean;
  email?: string | null;
  error?: string;
};

export function isGoogleCalendarConnected(status: GoogleCalendarStatus): boolean {
  return Boolean(status.connected || status.authorized);
}
