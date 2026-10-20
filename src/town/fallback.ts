// Decides whether the town (browser) interview can run here; a reason means fall
// back to the text interview in the terminal.
export function townUnavailableReason(input: {
  stdinTTY: boolean;
  stdoutTTY: boolean;
  env: Record<string, string | undefined>;
  open: boolean;
}): string | null {
  if (!input.stdinTTY || !input.stdoutTTY) {
    return "no interactive terminal";
  }
  const ci = input.env.CI;
  if (ci !== undefined && ci !== "" && ci !== "false" && ci !== "0") {
    return "running in CI";
  }
  // With --no-open the user opens the URL themselves, e.g. through a forwarded port.
  if (input.open && (input.env.SSH_CONNECTION || input.env.SSH_TTY)) {
    return "SSH session";
  }
  return null;
}
