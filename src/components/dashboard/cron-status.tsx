"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface CronLog {
  job_name: string;
  status: string;
  records_collected: number;
  finished_at: string;
}

export function CronStatus() {
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function fetchLogs() {
      const { data } = await supabase
        .from("dash_gestao_cron_logs")
        .select("job_name, status, records_collected, finished_at")
        .order("finished_at", { ascending: false })
        .limit(10);

      if (data) {
        const seen = new Set<string>();
        const unique = data.filter((log: CronLog) => {
          if (seen.has(log.job_name)) return false;
          seen.add(log.job_name);
          return true;
        });
        setLogs(unique);
      }
      setLoading(false);
    }

    fetchLogs();
  }, []);

  if (loading) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Status das Coletas</h3>
      <div className="flex gap-4">
        {["youtube", "instagram"].map((job) => {
          const log = logs.find((l) => l.job_name === job);
          const isOk = log?.status === "success";

          return (
            <div key={job} className="bg-white border rounded-lg p-3 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${isOk ? "bg-green-500" : "bg-red-500"}`}
              />
              <div>
                <p className="text-sm font-medium capitalize">{job}</p>
                {log ? (
                  <p className="text-xs text-gray-500">
                    {new Date(log.finished_at).toLocaleString("pt-BR")}
                    {" · "}
                    {log.records_collected} registros
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Sem coleta</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
