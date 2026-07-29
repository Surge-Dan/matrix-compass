import { DashboardApp } from "../components/dashboard/dashboard-app";
import { getDashboardData } from "../lib/dashboard-data";

export default function Home() {
  return <DashboardApp initialData={getDashboardData(30, "mc-initial-render")} />;
}
