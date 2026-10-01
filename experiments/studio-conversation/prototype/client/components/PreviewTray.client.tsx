import type { ReactNode } from "react";
export function PreviewTray({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id="studio-monitor"
      className={"preview-tray" + (open ? " is-open" : "")}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="preview-tray-inner">
        <div className="monitor-dock">{children}</div>
      </div>
    </div>
  );
}
