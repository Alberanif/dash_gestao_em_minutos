export default function AjustesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--color-background)",
        padding: "20px",
      }}
    >
      {children}
    </main>
  );
}
