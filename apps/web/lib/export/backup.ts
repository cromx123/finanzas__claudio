import { getExportAll } from "../api/client";
import { todayStamp, triggerDownload } from "./download";

/** Full-account backup — portfolios/transactions/goals/alerts/tags, as a
 * single downloadable JSON. Not a display format like the CSV/Excel movement
 * exports: this is meant to be re-readable data (portability/backup), so it
 * stays as the raw API shape rather than a formatted table.
 */
export async function exportAllDataJson() {
  const data = await getExportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, `inversiones3-backup_${todayStamp()}.json`);
}
