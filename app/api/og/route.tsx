import { ImageResponse } from "next/og";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

async function loadGoogleFont(family: string, weight: number, text: string) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(url, {
    headers: {
      // Google serves woff2 only to modern UAs
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
  }).then((r) => r.text());
  const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype|woff2)'\)/);
  if (!match) throw new Error(`Could not load font ${family}`);
  const fontData = await fetch(match[1]).then((r) => r.arrayBuffer());
  return fontData;
}

export async function GET() {
  const titleText = "AppoClick";
  const subtitleText = "Reserva citas en tu clínica en minutos, sin complicaciones";

  const [jakarta700, dm400] = await Promise.all([
    loadGoogleFont("Plus Jakarta Sans", 700, titleText),
    loadGoogleFont("DM Sans", 400, subtitleText),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E9E82",
          fontFamily: "DM Sans",
        }}
      >
        {/* Circle with checkmark */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 48,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path
              d="M14 33 L27 46 L50 20"
              stroke="#0E9E82"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: "Plus Jakarta Sans",
            fontSize: 96,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: -2,
            lineHeight: 1,
            marginBottom: 28,
          }}
        >
          {titleText}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "DM Sans",
            fontSize: 32,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          {subtitleText}
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        { name: "Plus Jakarta Sans", data: jakarta700, weight: 700, style: "normal" },
        { name: "DM Sans", data: dm400, weight: 400, style: "normal" },
      ],
    },
  );
}
