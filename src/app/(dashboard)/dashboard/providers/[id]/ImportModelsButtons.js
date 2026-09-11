"use client";

import PropTypes from "prop-types";
import { Button } from "@/shared/components";

export default function ImportModelsButtons({
  canImport = false,
  importing = false,
  onImportAll,
  onImportFree,
  size = "sm",
}) {
  if (!canImport) return null;
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-blue-500/40">
      <Button
        size={size}
        variant="ghost"
        icon="download"
        onClick={onImportAll}
        disabled={importing}
        className="rounded-none border-0 text-blue-600 hover:bg-blue-500/5 dark:text-blue-400"
        title="Fetch /models from this provider and add every new id"
      >
        {importing ? "Importing..." : "Import models"}
      </Button>
      <span className="h-5 w-px bg-blue-500/30" aria-hidden="true" />
      <Button
        size={size}
        variant="ghost"
        onClick={onImportFree}
        disabled={importing}
        className="rounded-none border-0 px-2 text-emerald-700 hover:bg-emerald-500/5 dark:text-emerald-300"
        title="Import only models the provider marks as free"
      >
        {importing ? "…" : "Import free"}
      </Button>
    </div>
  );
}

ImportModelsButtons.propTypes = {
  canImport: PropTypes.bool,
  importing: PropTypes.bool,
  onImportAll: PropTypes.func.isRequired,
  onImportFree: PropTypes.func.isRequired,
  size: PropTypes.string,
};
