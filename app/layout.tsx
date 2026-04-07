import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const dm = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://appoclick.com"),
  title: "AppoClick — Reserva de citas para clínicas",
  description:
    "Página de reservas online para tu clínica en minutos. Recordatorios automáticos, WhatsApp sin API, consultas online y RGPD incluido.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "AppoClick — Reserva de citas para clínicas",
    description:
      "Página de reservas online para tu clínica en minutos. Recordatorios automáticos, WhatsApp sin API, consultas online y RGPD incluido.",
    url: "https://appoclick.com",
    siteName: "AppoClick",
    images: [
      {
        url: "https://appoclick.com/api/og",
        width: 1200,
        height: 630,
        alt: "AppoClick — Reserva citas online para tu clínica",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AppoClick — Reserva de citas para clínicas",
    description: "Página de reservas online para tu clínica en minutos.",
    images: ["https://appoclick.com/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${jakarta.variable} ${dm.variable} antialiased`}>{children}</body>
    </html>
  );
}
