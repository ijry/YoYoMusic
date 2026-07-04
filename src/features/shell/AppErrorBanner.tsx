import type { AppErrorPayload } from "../../shared/errors";
import { mapAppError } from "../../shared/errors";

interface AppErrorBannerProps {
  error: AppErrorPayload | string | null;
}

export function AppErrorBanner({ error }: AppErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="app-error-banner" role="alert">
      {typeof error === "string" ? error : mapAppError(error)}
    </div>
  );
}
