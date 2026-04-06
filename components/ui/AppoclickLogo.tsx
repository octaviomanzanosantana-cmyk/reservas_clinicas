type AppoclickLogoProps = {
  variant?: "color" | "white";
  width?: number;
};

export default function AppoclickLogo({ variant = "color", width = 160 }: AppoclickLogoProps) {
  const text = variant === "white" ? "#FFFFFF" : "#0E9E82";
  const circle = variant === "white" ? "#FFFFFF" : "#0E9E82";
  const check = variant === "white" ? "#0E9E82" : "#FFFFFF";
  const height = Math.round(width * 0.28);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Appoclick"
    >
      {/* "Appo" */}
      <text
        x="0"
        y="76"
        fontFamily="'Plus Jakarta Sans', Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="64"
        letterSpacing="-1"
        fill={text}
      >
        Appo
      </text>

      {/* Círculo con check — centrado entre "Appo" y "Click" */}
      <circle cx="200" cy="52" r="22" fill={circle} />
      <path
        d="M191 52l6 6 12-12"
        stroke={check}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Líneas de brillo arriba-derecha del círculo */}
      <line x1="216" y1="30" x2="219" y2="23" stroke={circle} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="222" y1="35" x2="228" y2="30" stroke={circle} strokeWidth="2.5" strokeLinecap="round" />

      {/* "Click" */}
      <text
        x="228"
        y="76"
        fontFamily="'Plus Jakarta Sans', Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="64"
        letterSpacing="-1"
        fill={text}
      >
        Click
      </text>
    </svg>
  );
}
