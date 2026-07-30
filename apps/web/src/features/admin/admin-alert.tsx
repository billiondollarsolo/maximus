export function AdminAlert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "admin-alert admin-alert-error"
      : tone === "success"
        ? "admin-alert admin-alert-success"
        : "admin-alert admin-alert-info";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cls}>
      {children}
    </p>
  );
}
