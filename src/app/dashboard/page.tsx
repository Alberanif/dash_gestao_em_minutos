import { YouTubeOverview } from "@/components/dashboard/youtube-overview";
import { InstagramOverview } from "@/components/dashboard/instagram-overview";
import { CronStatus } from "@/components/dashboard/cron-status";

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <h2 className="text-xl font-semibold">Gestao em 4 Minutos</h2>
      <CronStatus />
      <YouTubeOverview />
      <InstagramOverview />
    </div>
  );
}
