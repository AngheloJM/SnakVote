export function ConectaLogo({ size = 28 }: { size?: number }) {
  return (
    <div className="conecta-logo">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="18" r="1.8" fill="#F59A45" />
        <path
          d="M8 14.5a6 6 0 0 1 8 0"
          stroke="#F59A45"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M5 11a10.5 10.5 0 0 1 14 0"
          stroke="#E47704"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="conecta-logo-text">
        CONECTA
        <small>Conectamos personas</small>
      </span>
    </div>
  );
}
