"use client";

interface ProjectPickerModalProps {
  open: boolean;
  projects: string[];
  selected: string[];
  onSelect: (projeto: string) => void;
  onClose: () => void;
}

export function ProjectPickerModal({
  open,
  projects,
  selected,
  onSelect,
  onClose,
}: ProjectPickerModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: 400,
          width: "90%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>
            Selecionar Projeto
          </h2>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
          {projects.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", padding: "20px" }}>
              Nenhum projeto disponível.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {projects.map((project) => {
                const isSelected = selected.includes(project);
                return (
                  <button
                    key={project}
                    onClick={() => onSelect(project)}
                    disabled={isSelected}
                    style={{
                      background: isSelected ? "var(--color-bg)" : "transparent",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: 500,
                      color: isSelected ? "var(--color-text-muted)" : "var(--color-text)",
                      cursor: isSelected ? "not-allowed" : "pointer",
                      opacity: isSelected ? 0.6 : 1,
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--color-bg)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }
                    }}
                  >
                    {project}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "16px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
