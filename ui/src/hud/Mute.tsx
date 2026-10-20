export function Mute(props: { muted: boolean; onToggle: () => void }) {
  const label = props.muted ? "Play music" : "Mute music";
  return (
    <button
      type="button"
      className="mute"
      aria-label={label}
      title={label}
      aria-pressed={props.muted}
      onClick={props.onToggle}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        {props.muted ? (
          <path
            d="M16 9.5l5 5m0-5l-5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
