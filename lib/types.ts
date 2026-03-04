export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "rescheduled";

export type Appointment = {
  token: string;
  clinicName: string;
  service: string;
  datetimeLabel: string;
  patientName: string;
  address: string;
  durationLabel: string;
  status: AppointmentStatus;
  lastUpdateLabel: string;
  idLabel: string;
};

export type DemoClinicConfig = {
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
