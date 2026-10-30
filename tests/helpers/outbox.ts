/** Every email the app tried to send in this test, in order. */
export const sentEmails: { to: string; subject: string; text: string }[] = [];

export const emailFailures = { next: 0 };

/** The first link in the last email to this address. */
export function lastLinkTo(address: string): URL {
  const email = sentEmails.findLast((entry) => entry.to === address);
  const match = email?.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No link emailed to ${address}`);
  return new URL(match[0]);
}

export const tokenFrom = (url: URL) => url.searchParams.get("token") ?? "";
