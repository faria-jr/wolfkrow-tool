export default function PermissionsPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Tool permissions are configured per-agent. Open an agent to manage its allowed tools.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Audit log is available via the Logs page.
      </p>
    </div>
  );
}
