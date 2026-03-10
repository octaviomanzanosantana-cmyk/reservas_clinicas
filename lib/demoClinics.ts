import type { DemoClinicConfig } from "@/lib/types";

export const DEMO_CLINICS: Record<string, DemoClinicConfig> = {
  demo123: {
    clinicSlug: "pilarcastillo",
    clinicName: "Clínica Pilar Castillo",
    themeColor: "#2563EB",
    supportPhone: "+34 600 000 000",
    whatsappPhone: "34600000000",
    address: "San Bernardo 19, Las Palmas",
    logoText: "PC",
    services: ["Diagnóstico capilar", "Mesoterapia capilar", "Revisión"],
    defaultAppointment: {
      service: "Diagnóstico capilar",
      datetimeLabel: "Jueves · 18:00",
      patientName: "Marta García",
      durationLabel: "30 min",
      idLabel: "PC-10492",
    },
  },
  pilarcastillo: {
    clinicSlug: "pilarcastillo",
    clinicName: "Clínica Pilar Castillo",
    themeColor: "#2563EB",
    supportPhone: "+34 600 000 000",
    whatsappPhone: "34600000000",
    address: "San Bernardo 19, Las Palmas",
    logoText: "PC",
    services: ["Diagnóstico capilar", "Mesoterapia capilar", "Revisión"],
    defaultAppointment: {
      service: "Diagnóstico capilar",
      datetimeLabel: "Jueves · 18:00",
      patientName: "Marta García",
      durationLabel: "30 min",
      idLabel: "PC-10492",
    },
  },
  "fisio-demo": {
    clinicSlug: "fisio-demo",
    clinicName: "Fisio Atlántico",
    themeColor: "#059669",
    supportPhone: "+34 611 111 111",
    whatsappPhone: "34611111111",
    address: "Av. de Escaleritas 88, Las Palmas",
    logoText: "FA",
    services: ["Fisioterapia deportiva", "Masaje terapéutico", "Readaptación"],
    defaultAppointment: {
      service: "Fisioterapia deportiva",
      datetimeLabel: "Martes · 10:00",
      patientName: "Carlos Martín",
      durationLabel: "45 min",
      idLabel: "FA-22510",
    },
  },
  "dental-demo": {
    clinicSlug: "dental-demo",
    clinicName: "Dental Norte",
    themeColor: "#7C3AED",
    supportPhone: "+34 622 222 222",
    whatsappPhone: "34622222222",
    address: "Calle Triana 44, Las Palmas",
    logoText: "DN",
    services: ["Revisión dental", "Higiene", "Ortodoncia"],
    defaultAppointment: {
      service: "Revisión dental",
      datetimeLabel: "Miércoles · 12:00",
      patientName: "Laura Pérez",
      durationLabel: "30 min",
      idLabel: "DN-77831",
    },
  },
};

export const DEMO_TOKENS = Object.keys(DEMO_CLINICS);

export function getClinicConfig(token: string): DemoClinicConfig {
  return DEMO_CLINICS[token] ?? DEMO_CLINICS.demo123;
}

export function getClinicSlugByClinicName(clinicName: string): string | null {
  const match = Object.values(DEMO_CLINICS).find((clinic) => clinic.clinicName === clinicName);
  return match?.clinicSlug ?? null;
}
