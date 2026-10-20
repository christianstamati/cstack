// The final report on the billboard: what was built, the commands to run (each with a copy
// button), what is left to do by hand and what wasn't verified. Once the finale has played
// it says the project is ready. It stays up after the agent stops.
import { useEffect, useRef, useState } from "react";

import { slotById } from "../../../src/town/catalog.ts";
import type { ReportView } from "../../../src/town/protocol.ts";
import { READY_MESSAGE } from "../logic.ts";
import { useFinaleOver } from "../scene/finale.ts";

/** Copies `text`: the clipboard API where the page may use it, else the old copy command on
 * a hidden text area. False when neither worked. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused (no permission, or the page isn't focused): try the old way.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    // Deprecated, but the only way left when the clipboard API is refused.
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

/** Selects the text of `element`, so the user can copy it by hand. */
function selectText(element: HTMLElement | null): void {
  const selection = window.getSelection();
  if (!element || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

const COPY_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘C" : "Ctrl+C";

function Command({ command }: { command: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const code = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), copied === "yes" ? 1600 : 4000);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <li className="report-command">
      <code ref={code}>{command}</code>
      <button
        type="button"
        className="report-copy"
        aria-label={`Copy ${command}`}
        onClick={async () => {
          const ok = await copyText(command);
          if (!ok) selectText(code.current);
          setCopied(ok ? "yes" : "no");
        }}
      >
        {copied === "yes" ? "Copied" : copied === "no" ? `Press ${COPY_KEY}` : "Copy"}
      </button>
    </li>
  );
}

export function ReportCard(props: { report: ReportView; takeFocus: boolean }) {
  const { report, takeFocus } = props;
  const ready = useFinaleOver();
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (takeFocus) card.current?.focus({ preventScroll: true });
  }, [takeFocus]);
  return (
    <section ref={card} className="question report" tabIndex={-1} aria-label="Report">
      <header className="question-head">
        <span className="question-kind">Report</span>
      </header>
      {ready ? (
        <h2 className="question-text report-ready" role="status">
          {READY_MESSAGE}
        </h2>
      ) : (
        <h2 className="question-text">All built</h2>
      )}
      {report.built.length > 0 ? (
        <div className="plan-section">
          <h3>Built</h3>
          <ul className="plan-list report-built">
            {report.built.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {report.commands.length > 0 ? (
        <div className="plan-section">
          <h3>Commands</h3>
          <ul className="report-commands">
            {report.commands.map((command, i) => (
              <Command key={i} command={command} />
            ))}
          </ul>
        </div>
      ) : null}
      {report.manualSteps.length > 0 ? (
        <div className="plan-section">
          <h3>Left for you</h3>
          <ul className="plan-list">
            {report.manualSteps.map((step, i) => (
              <li key={i}>
                {step.text}
                {step.slot ? (
                  <span className="report-slot">{slotById(step.slot).label}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {report.unverified.length > 0 ? (
        <div className="plan-section">
          <h3>Not verified yet</h3>
          <ul className="plan-list report-unverified">
            {report.unverified.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
