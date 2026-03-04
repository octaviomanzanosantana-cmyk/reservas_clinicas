type AppointmentLayoutProps = {
  children: React.ReactNode;
};

export default function AppointmentLayout({ children }: AppointmentLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
