export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "change_requested"
  | "cancelled"
  | "completed";
export type ActivityAction = "confirmed" | "change_requested" | "cancelled";

export type ActivityEvent = {
  token: string;
  patientName: string;
  datetimeLabel: string;
  action: ActivityAction;
  timestamp: string;
};

export type Appointment = {
  token: string;
  clinicName: string;
  service: string;
  datetimeLabel: string;
  scheduledAt?: string | null;
  patientName: string;
  address: string;
  durationLabel: string;
  status: AppointmentStatus;
  lastUpdateLabel: string;
  idLabel: string;
};

export type DemoClinicConfig = {
  clinicSlug: string;
  clinicName: string;
  themeColor: string;
  supportPhone: string;
  whatsappPhone: string;
  address: string;
  logoText: string;
  services: string[];
  defaultAppointment: Omit<
    Appointment,
    "token" | "clinicName" | "address" | "status" | "lastUpdateLabel"
  >;
};
