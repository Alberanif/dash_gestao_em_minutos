"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LtvCard } from "@/components/ltv/ltv-card";
import type { LtvMetrics } from "@/types/ltv";

function getDefaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function LtvPage() {
  const defaults = getDefaultPeriod();
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);

  const [matrizMetrics, setMatrizMetrics] = useState<LtvMetrics | null>(null);
  const [solidesMetrics, setSolidesMetrics] = useState<LtvMetrics | null>(null);
  const [loadingMatriz, setLoadingMatriz] = useState(true);
  const [loadingSolides, setLoadingSolides] = useState(true);

  const fetchMetrics = useCallback(async (s: string, e: string) => {
    setLoadingMatriz(true);
    setLoadingSolides(true);

    const [matrizRes, solidesRes] = await Promise.all([
      fetch(`/api/ltv/matriz-humana/metrics?start=${s}&end=${e}`),
      fetch(`/api/ltv/solides/metrics?start=${s}&end=${e}`),
    ]);

    const [matrizData, solidesData] = await Promise.all([
      matrizRes.json(),
      solidesRes.json(),
    ]);

    setMatrizMetrics(matrizData?.error ? null : matrizData);
    setSolidesMetrics(solidesData?.error ? null : solidesData);
    setLoadingMatriz(false);
    setLoadingSolides(false);
  }, []);

  useEffect(() => {
    fetchMetrics(start, end);
  }, [fetchMetrics, start, end]);

  return (
    <div className="min-h-full">
      <PageHeader
        title="LTV"
        subtitle="Acompanhe as assinaturas por fonte"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>De</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{
                fontSize: 13,
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
              }}
            />
            <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Até</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{
                fontSize: 13,
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
              }}
            />
          </div>
        }
      />

      <div style={{ padding: 24 }}>
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
              LTV
            </h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: 99,
                padding: "2px 10px",
              }}
            >
              2
            </span>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <LtvCard
              title="Matriz Humana"
              start={start}
              end={end}
              metrics={matrizMetrics}
              loading={loadingMatriz}
            />
            <LtvCard
              title="Solides"
              start={start}
              end={end}
              metrics={solidesMetrics}
              loading={loadingSolides}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
