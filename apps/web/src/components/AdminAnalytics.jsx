import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const totalCards = [
  ["new_users", "New users", "fa-user-plus", "text-blue-600"],
  ["records", "Records added", "fa-file-medical", "text-emerald-600"],
  ["messages", "Messages sent", "fa-comments", "text-violet-600"],
  ["appointments", "Appointments", "fa-calendar-check", "text-amber-600"],
  ["prescriptions", "Prescriptions", "fa-prescription", "text-cyan-600"],
  ["emergency_alerts", "SOS alerts", "fa-triangle-exclamation", "text-rose-600"],
];

const trendSeries = [
  ["registrations", "Registrations", "bg-blue-500"],
  ["records", "Records", "bg-emerald-500"],
  ["messages", "Messages", "bg-violet-500"],
  ["appointments", "Appointments", "bg-amber-500"],
  ["prescriptions", "Prescriptions", "bg-cyan-500"],
];

const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const AdminAnalytics = () => {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get("/api/admin/analytics", {
        params: { range_days: rangeDays },
      });
      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Unable to load analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    load();
  }, [load]);

  const maxActivity = useMemo(
    () =>
      Math.max(
        ...(data?.trends || []).map((bucket) =>
          trendSeries.reduce(
            (sum, [key]) => sum + Number(bucket[key] || 0),
            0,
          ),
        ),
        1,
      ),
    [data],
  );

  const exportAnalytics = () => {
    if (!data) return;
    const lines = [
      ["Period", `${data.range_days} days`],
      ["Generated", data.generated_at],
      [],
      ["Metric", "Value"],
      ...totalCards.map(([key, label]) => [label, data.totals?.[key] || 0]),
      [],
      [
        "Period",
        ...trendSeries.map(([, label]) => label),
      ],
      ...(data.trends || []).map((bucket) => [
        bucket.label,
        ...trendSeries.map(([key]) => bucket[key] || 0),
      ]),
    ];
    const csv = lines.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `careconnect-admin-analytics-${data.range_days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Admin Analytics</h2>
            <p className="mt-1 text-sm text-purple-100">
              Operational activity, engagement, and clinical risk signals.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={rangeDays}
              onChange={(event) => setRangeDays(Number(event.target.value))}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            >
              <option className="text-gray-900" value={7}>Last 7 days</option>
              <option className="text-gray-900" value={30}>Last 30 days</option>
              <option className="text-gray-900" value={90}>Last 90 days</option>
              <option className="text-gray-900" value={365}>Last year</option>
            </select>
            <button
              type="button"
              onClick={exportAnalytics}
              disabled={!data}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-purple-700 disabled:opacity-50"
            >
              <i className="fas fa-download mr-2"></i>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {totalCards.map(([key, label, icon, color]) => (
          <div
            key={key}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-md"
          >
            <div className="flex items-center justify-between">
              <i className={`fas ${icon} ${color}`}></i>
              <span className={`text-2xl font-black ${color}`}>
                {loading ? "—" : data?.totals?.[key] || 0}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-600">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Platform activity
              </h3>
              <p className="text-sm text-gray-500">
                Activity grouped across the selected period.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {trendSeries.map(([, label, color]) => (
                <span key={label} className="flex items-center gap-1 text-xs text-gray-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`}></span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex h-64 items-end gap-2 overflow-x-auto border-b border-gray-200 pb-7">
            {(data?.trends || []).map((bucket) => {
              const total = trendSeries.reduce(
                (sum, [key]) => sum + Number(bucket[key] || 0),
                0,
              );
              return (
                <div
                  key={bucket.label}
                  className="relative flex min-w-8 flex-1 items-end justify-center"
                  title={`${bucket.label}: ${total} total activities`}
                >
                  <div
                    className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-t"
                    style={{
                      height: `${Math.max((total / maxActivity) * 210, total ? 8 : 2)}px`,
                    }}
                  >
                    {trendSeries.map(([key, , color]) => (
                      <span
                        key={key}
                        className={color}
                        style={{
                          height: `${total ? (Number(bucket[key] || 0) / total) * 100 : 0}%`,
                        }}
                      ></span>
                    ))}
                  </div>
                  <span className="absolute -bottom-6 whitespace-nowrap text-[10px] text-gray-500">
                    {bucket.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
            <h3 className="font-bold text-gray-800">Operational health</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span>Unread messages</span><b>{data?.operations?.unread_messages || 0}</b></div>
              <div className="flex justify-between"><span>Active care connections</span><b>{data?.operations?.active_connections || 0}</b></div>
              <div className="flex justify-between"><span>Appointment completion</span><b>{data?.operations?.appointment_completion_rate || 0}%</b></div>
              <div className="flex justify-between text-rose-700"><span>Actionable SOS alerts</span><b>{data?.operations?.actionable_alerts || 0}</b></div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
            <h3 className="font-bold text-gray-800">Patient status</h3>
            <div className="mt-4 space-y-3">
              {[
                ["stable", "Stable", "bg-emerald-500"],
                ["attention", "Needs attention", "bg-amber-500"],
                ["critical", "Critical", "bg-rose-500"],
              ].map(([key, label, color]) => {
                const statuses = data?.patient_status || {};
                const total = Object.values(statuses).reduce(
                  (sum, value) => sum + Number(value || 0),
                  0,
                );
                const count = Number(statuses[key] || 0);
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{label}</span><b>{count}</b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full ${color}`}
                        style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
