import React, { useMemo, useState } from "react";
import axios from "axios";

const formatLabel = (value) => {
  if (!value) return "N/A";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const AIReportComparison = ({ records = [] }) => {
  const [firstRecordId, setFirstRecordId] = useState("");
  const [secondRecordId, setSecondRecordId] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const comparableRecords = useMemo(() => {
    return records.filter((record) => record?.id);
  }, [records]);

  const selectedFirstRecord = comparableRecords.find(
    (record) => String(record.id) === String(firstRecordId),
  );

  const selectedSecondRecord = comparableRecords.find(
    (record) => String(record.id) === String(secondRecordId),
  );

  const compareReports = async () => {
    if (!firstRecordId || !secondRecordId) {
      setError("Please select two medical records to compare.");
      return;
    }

    if (String(firstRecordId) === String(secondRecordId)) {
      setError("Please select two different medical records.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setComparison(null);

      const token = localStorage.getItem("access_token");

      const res = await axios.post(
        "http://localhost:8000/api/records/compare",
        {
          first_record_id: Number(firstRecordId),
          second_record_id: Number(secondRecordId),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setComparison(res.data);
    } catch (err) {
      console.error("Report comparison failed:", err.response?.data || err);
      setError(err.response?.data?.detail || "Failed to compare reports.");
    } finally {
      setLoading(false);
    }
  };

  const exportComparison = (format) => {
    if (!comparison) return;

    let content;
    let mediaType;
    if (format === "json") {
      content = JSON.stringify(comparison, null, 2);
      mediaType = "application/json";
    } else {
      const escapeCsv = (value) =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = [
        ["AI Report Comparison"],
        ["First report", comparison.first_record?.name],
        ["Second report", comparison.second_record?.name],
        ["Summary", comparison.ai_summary || comparison.summary],
        [],
        ["Metric", "First value", "Second value", "Difference", "Status"],
        ...(comparison.metric_comparison || []).map((metric) => [
          metric.metric,
          metric.first_value,
          metric.second_value,
          metric.difference,
          metric.status,
        ]),
        [],
        ["Improved items", ...(comparison.improved_items || [])],
        ["Worsened items", ...(comparison.worsened_items || [])],
        ["New concerns", ...(comparison.new_concerns || [])],
        [
          "Recommended next steps",
          ...(comparison.recommended_next_steps || []),
        ],
      ];
      content = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
      mediaType = "text/csv";
    }

    const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `careconnect-report-comparison.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderList = (title, items, icon, emptyText) => (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <i className={`fas ${icon}`}></i>
        {title}
      </h4>

      {items && items.length > 0 ? (
        <ul className="space-y-2 text-sm text-gray-700">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>
                {typeof item === "string" ? item : JSON.stringify(item)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{emptyText}</p>
      )}
    </div>
  );

  const renderMetricTable = () => {
    const metrics = comparison?.metric_comparison || [];

    if (!metrics.length) {
      return (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-2">Metric Changes</h4>
          <p className="text-sm text-gray-500">
            No structured metrics were detected for comparison.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h4 className="font-bold text-gray-800">Metric Changes</h4>
          <p className="text-sm text-gray-500">
            Structured values detected from both reports.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Metric</th>
                <th className="text-left px-4 py-3">First Report</th>
                <th className="text-left px-4 py-3">Second Report</th>
                <th className="text-left px-4 py-3">Difference</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {metrics.map((metric, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {formatLabel(metric.metric)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {metric.first_value ?? "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {metric.second_value ?? "N/A"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {metric.difference ?? "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        metric.status === "increased"
                          ? "bg-yellow-100 text-yellow-700"
                          : metric.status === "decreased"
                            ? "bg-blue-100 text-blue-700"
                            : metric.status === "new"
                              ? "bg-purple-100 text-purple-700"
                              : metric.status === "removed"
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                      }`}
                    >
                      {formatLabel(metric.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-code-compare text-indigo-600"></i>
            AI Report Comparison
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Select two medical records and compare changes using extracted
            report data.
          </p>
        </div>

        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
          AI Assisted
        </span>
      </div>

      {comparableRecords.length < 2 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
          Upload at least two medical records to use AI report comparison.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                First / Older Report
              </label>
              <select
                value={firstRecordId}
                onChange={(e) => setFirstRecordId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select first report</option>
                {comparableRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.name} —{" "}
                    {record.uploaded_at
                      ? new Date(record.uploaded_at).toLocaleDateString()
                      : "No date"}
                  </option>
                ))}
              </select>

              {selectedFirstRecord && (
                <p className="text-xs text-gray-500">
                  {selectedFirstRecord.category} • {selectedFirstRecord.type}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Second / Newer Report
              </label>
              <select
                value={secondRecordId}
                onChange={(e) => setSecondRecordId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select second report</option>
                {comparableRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.name} —{" "}
                    {record.uploaded_at
                      ? new Date(record.uploaded_at).toLocaleDateString()
                      : "No date"}
                  </option>
                ))}
              </select>

              {selectedSecondRecord && (
                <p className="text-xs text-gray-500">
                  {selectedSecondRecord.category} • {selectedSecondRecord.type}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={compareReports}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
            >
              <i className="fas fa-wand-magic-sparkles mr-2"></i>
              {loading ? "Comparing..." : "Compare Reports"}
            </button>

            {comparison && (
              <button
                onClick={() => {
                  setComparison(null);
                  setError("");
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3 rounded-lg font-semibold transition"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="mt-5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {comparison && (
        <div className="mt-8 space-y-6">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h4 className="text-lg font-bold">Comparison Summary</h4>

              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                {comparison.metric_comparison?.length || 0} Metrics Compared
              </span>
            </div>

            {/* <p className="text-sm leading-7 mb-4">
              {comparison.ai_summary || comparison.summary}
            </p> */}

            {comparison.comparison_points?.length > 0 && (
              <div className="bg-white/10 p-4 rounded-lg mt-4">
                <h5 className="font-bold mb-3">Point-wise Comparison</h5>

                <ul className="space-y-2 text-sm leading-6 list-disc pl-5">
                  {comparison.comparison_points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

              {/* {comparison.metric_comparison?.length > 0 && (
                <p className="text-sm leading-7 bg-white/10 p-4 rounded-lg mb-4">
                  {comparison.metric_comparison
                    .filter((metric) =>
                      [
                        "increased",
                        "decreased",
                        "changed",
                        "new",
                        "removed",
                      ].includes(metric.status),
                    )
                    .map((metric) => {
                      const metricName = formatLabel(metric.metric);

                      if (metric.status === "increased") {
                        return `${metricName} increased from ${metric.first_value ?? "N/A"} to ${metric.second_value ?? "N/A"}.`;
                      }

                      if (metric.status === "decreased") {
                        return `${metricName} decreased from ${metric.first_value ?? "N/A"} to ${metric.second_value ?? "N/A"}.`;
                      }

                      if (metric.status === "changed") {
                        return `${metricName} changed from ${metric.first_value ?? "N/A"} to ${metric.second_value ?? "N/A"}.`;
                      }

                      if (metric.status === "new") {
                        return `${metricName} is newly present in the second report with value ${metric.second_value ?? "N/A"}.`;
                      }

                      if (metric.status === "removed") {
                        return `${metricName} was present in the first report but is missing in the second report.`;
                      }

                      return "";
                    })
                    .filter(Boolean)
                    .join(" ")}
                </p>
              )} */}
{/* 
            {comparison.new_concerns?.length > 0 && (
              <p className="text-sm leading-7 bg-white/10 p-4 rounded-lg mb-4">
                New concerns found in the second report:{" "}
                {comparison.new_concerns.join("; ")}.
              </p>
            )} */}

            {/* {comparison.resolved_findings?.length > 0 && (
              <p className="text-sm leading-7 bg-white/10 p-4 rounded-lg mb-4">
                Findings present in the first report but not in the second
                report: {comparison.resolved_findings.join("; ")}.
              </p>
            )} */}

            {/* {comparison.stable_items?.length > 0 && (
              <p className="text-sm leading-7 bg-white/10 p-4 rounded-lg mb-4">
                Stable findings across both reports:{" "}
                {comparison.stable_items.join("; ")}.
              </p>
            )}

            {comparison.recommended_next_steps?.length > 0 && (
              <p className="text-sm leading-7 bg-white/10 p-4 rounded-lg">
                Recommended next steps:{" "}
                {comparison.recommended_next_steps.join(" ")}
              </p>
            )} */}

            <p className="text-xs leading-6 mt-5 bg-yellow-300/20 border border-yellow-200/40 rounded-lg p-4">
              Note: This comparison is AI-assisted and should be reviewed by a
              qualified healthcare professional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
              <h4 className="font-bold text-gray-800 mb-2">First Report</h4>
              <p className="font-semibold text-blue-700">
                {comparison.first_record?.name}
              </p>
              <p className="text-sm text-gray-600">
                {comparison.first_record?.category} •{" "}
                {comparison.first_record?.type}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Uploaded:{" "}
                {comparison.first_record?.uploaded_at
                  ? new Date(
                      comparison.first_record.uploaded_at,
                    ).toLocaleString()
                  : "N/A"}
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
              <h4 className="font-bold text-gray-800 mb-2">Second Report</h4>
              <p className="font-semibold text-purple-700">
                {comparison.second_record?.name}
              </p>
              <p className="text-sm text-gray-600">
                {comparison.second_record?.category} •{" "}
                {comparison.second_record?.type}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Uploaded:{" "}
                {comparison.second_record?.uploaded_at
                  ? new Date(
                      comparison.second_record.uploaded_at,
                    ).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* {renderMetricTable()} */}

          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> */}
          {/* {renderList(
              "Improved Items",
              comparison.improved_items,
              "fa-arrow-trend-up text-green-600",
              "No improvement items identified."
            )}

            {renderList(
              "Worsened Items",
              comparison.worsened_items,
              "fa-arrow-trend-down text-red-600",
              "No worsened items identified."
            )}

            {renderList(
              "New Concerns",
              comparison.new_concerns,
              "fa-triangle-exclamation text-yellow-600",
              "No new concerns identified."
            )}

            {renderList(
              "Stable Items",
              comparison.stable_items,
              "fa-circle-check text-blue-600",
              "No stable/common findings identified."
            )}
          </div>

          {renderList(
            "Recommended Next Steps",
            comparison.recommended_next_steps,
            "fa-list-check text-indigo-600",
            "No next steps generated."
          )} */}

          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
            <strong>Medical disclaimer:</strong> This AI comparison is for
            informational purposes only. Always consult a qualified healthcare
            professional for diagnosis, treatment, or medication changes.
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReportComparison;
