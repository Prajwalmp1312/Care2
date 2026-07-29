import React, { useState } from "react";
import axios from "axios";

const ClinicalExportButton = ({ patientEmail, dark = false }) => {
  const [loadingFormat, setLoadingFormat] = useState("");
  const [error, setError] = useState("");

  const download = async (format) => {
    try {
      setLoadingFormat(format);
      setError("");
      const response = await axios.get(
        `/api/exports/patients/${encodeURIComponent(patientEmail)}/summary`,
        {
          params: { export_format: format },
          responseType: "blob",
        },
      );
      const disposition = response.headers["content-disposition"] || "";
      const filename =
        disposition.match(/filename="?([^"]+)"?/)?.[1] ||
        `clinical-summary.${format}`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Clinical export failed",
      );
    } finally {
      setLoadingFormat("");
    }
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {["csv", "json"].map((format) => (
        <button
          type="button"
          key={format}
          onClick={() => download(format)}
          disabled={!!loadingFormat}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
            dark
              ? "bg-white/15 text-white hover:bg-white/25"
              : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          <i
            className={`fas ${
              loadingFormat === format ? "fa-spinner fa-spin" : "fa-download"
            } mr-2`}
          ></i>
          {format.toUpperCase()}
        </button>
      ))}
      {error && (
        <span className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg bg-red-50 p-2 text-xs text-red-700 shadow">
          {error}
        </span>
      )}
    </div>
  );
};

export default ClinicalExportButton;
