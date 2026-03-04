export type ClinicTheme = {
  brandName: string;
  primary: string;
  accent: string;
  logoText: string;
};

const DEFAULT_THEME: ClinicTheme = {
  brandName: "Reservas Clínicas",
  primary: "#2563EB",
  accent: "#0EA5E9",
  logoText: "RC",
};

const THEMES: Record<string, ClinicTheme> = {
  demo123: {
    brandName: "Clínica Pilar Castillo",
    primary: "#2563EB",
    accent: "#0EA5E9",
    logoText: "PC",
  },
  pilarcastillo: {
    brandName: "Clínica Pilar Castillo",
    primary: "#2563EB",
    accent: "#0EA5E9",
    logoText: "PC",
  },
  "fisio-demo": {
    brandName: "Fisio Atlántico",
    primary: "#059669",
    accent: "#14B8A6",
    logoText: "FA",
  },
  "dental-demo": {
    brandName: "Dental Norte",
    primary: "#7C3AED",
    accent: "#A855F7",
    logoText: "DN",
  },
};

export function getClinicTheme(token?: string): ClinicTheme {
  if (!token) return DEFAULT_THEME;
  return THEMES[token] ?? DEFAULT_THEME;
}

export { THEMES as clinicThemes };
