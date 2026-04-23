"use client";

import Link from "next/link";
import MccFccProjeto from "./_MccFccProjeto";
import FccMccMensal from "./_FccMccMensal";
import UltimateMensal from "./_UltimateMensal";
import UltimateProjeto from "./_UltimateProjeto";
import DestraveProjeto from "./_DestraveProjeto";

export default function EntregaNivelAPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>
      <header className="bdd-page-header">
        <Link href="/base-de-dados" className="bdd-back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Voltar
        </Link>
        <span style={{ color: "var(--color-border)", fontSize: 18, userSelect: "none" }}>/</span>
        <h1 className="bdd-page-title">Entrega Nível A</h1>
      </header>

      <div style={{ padding: "32px 24px 0", display: "flex", flexDirection: "column", gap: 48 }}>
        <MccFccProjeto />
        <FccMccMensal />
        <UltimateMensal />
        <UltimateProjeto />
        <DestraveProjeto />
      </div>
    </div>
  );
}
