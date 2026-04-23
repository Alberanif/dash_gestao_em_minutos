"use client";

import Link from "next/link";
import FunilDestrave from "./_FunilDestrave";
import Ultimate from "./_Ultimate";
import UltimatePercentuais from "./_UltimatePercentuais";
import Fcc from "./_Fcc";
import Mcc from "./_Mcc";
import SocialSeller from "./_SocialSeller";

export default function ConvitePage() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link
          href="/base-de-dados"
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Voltar
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
          Convite
        </h1>
      </div>

      <FunilDestrave />
      <Ultimate />
      <UltimatePercentuais />
      <Fcc />
      <Mcc />
      <SocialSeller />
    </div>
  );
}
