import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

const POLL_INTERVAL_MS = 15000;

const formatLabel = (value) =>
  value
    ? String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "N/A";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const EmergencyAlerts = ({ user }) => {
  const [alerts, setAlerts] = useState([]);
  const [monitoring, setMonitoring] = useState({
    active: 0,
    unassigned: 0,
    overdue: 0,
    escalated: 0,
    level_three: 0,
    response_target_minutes: 5,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");

  const requestConfig = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
  });

  const loadAlerts = async ({ showSpinner = true } = {}) => {
    try {
      if (showSpinner) setLoading(true);
      setError("");
      const url =
        statusFilter === "all"
          ? "/api/emergency-alerts"
          : `/api/emergency-alerts?status=${statusFilter}`;
      const [alertsResponse, monitoringResponse] = await Promise.all([
        axios.get(url, requestConfig()),
        axios.get(
          "/api/emergency-alerts/monitoring",
          requestConfig(),
        ),
      ]);
      setAlerts(alertsResponse.data);
      setMonitoring(monitoringResponse.data);
    } catch (err) {
      console.error("Emergency alerts load failed:", err.response?.data || err);
      setError(
        err.response?.data?.detail || "Failed to load emergency alerts.",
      );
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const poller = window.setInterval(
      () => loadAlerts({ showSpinner: false }),
      POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(poller);
  }, [statusFilter]);

  const performAction = async (alertId, action, body = {}) => {
    try {
      setActionId(alertId);
      setError("");
      await axios.put(
        `/api/emergency-alerts/${alertId}/${action}`,
        body,
        requestConfig(),
      );
      await loadAlerts({ showSpinner: false });
    } catch (err) {
      console.error(`${action} failed:`, err.response?.data || err);
      setError(
        err.response?.data?.detail || `Failed to ${formatLabel(action)} alert.`,
      );
    } finally {
      setActionId(null);
    }
  };

  const checkIn = (alertId) => {
    const notes = window.prompt(
      "Record the latest response check-in or follow-up:",
    );
    if (notes?.trim()) {
      performAction(alertId, "check-in", { notes: notes.trim() });
    }
  };

  const escalate = (alertId) => {
    const reason = window.prompt("Why is this SOS being escalated?");
    if (reason?.trim()) {
      performAction(alertId, "escalate", { reason: reason.trim() });
    }
  };

  const summary = useMemo(
    () => ({
      shown: alerts.length,
      active: monitoring.active || 0,
      unassigned: monitoring.unassigned || 0,
      overdue: monitoring.overdue || 0,
      escalated: monitoring.escalated || 0,
    }),
    [alerts, monitoring],
  );

  const severityClass = (severity) => {
    if (severity === "critical") return "bg-red-100 text-red-700 border-red-200";
    if (severity === "high")
      return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  const statusClass = (status) => {
    if (status === "active") return "bg-red-100 text-red-700";
    if (status === "acknowledged") return "bg-blue-100 text-blue-700";
    if (status === "resolved") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <i className="fas fa-triangle-exclamation text-red-600"></i>
            Emergency Response Operations
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Assign ownership, document monitoring, escalate, and resolve patient
            SOS notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAlerts()}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
        >
          <i className="fas fa-rotate-right"></i>
          Refresh
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <p className="font-bold">
          <i className="fas fa-shield-heart mr-2"></i>
          Operational safety boundary
        </p>
        <p>
          CareConnect coordinates and monitors notifications; it does not
          automatically dispatch emergency services. The backend checks active
          alerts continuously, with a staff review target of{" "}
          {monitoring.response_target_minutes || 5} minutes, and escalates when
          a review is missed.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          [
            "Shown",
            summary.shown,
            "border-gray-100 bg-gray-50",
            "text-gray-700",
          ],
          [
            "Active",
            summary.active,
            "border-red-100 bg-red-50",
            "text-red-700",
          ],
          [
            "Unassigned",
            summary.unassigned,
            "border-orange-100 bg-orange-50",
            "text-orange-700",
          ],
          [
            "Overdue",
            summary.overdue,
            "border-rose-100 bg-rose-50",
            "text-rose-700",
          ],
          [
            "Level 2–3",
            summary.escalated,
            "border-violet-100 bg-violet-50",
            "text-violet-700",
          ],
        ].map(([label, value, cardClass, valueClass]) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${cardClass}`}
          >
            <p className="text-sm text-gray-600">{label}</p>
            <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-red-500"
        >
          <option value="all">All Alerts</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="text-xs text-slate-500">
          Monitoring refreshes every 15 seconds
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div className="py-12 text-center">
          <i className="fas fa-spinner fa-spin mb-4 text-3xl text-red-600"></i>
          <p className="text-gray-600">Loading emergency alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 py-12 text-center">
          <i className="fas fa-shield-heart mb-4 text-5xl text-gray-300"></i>
          <p className="font-semibold text-gray-600">
            No emergency alerts found
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((item, index) => {
            const ownedByCurrentUser = item.owner_email === user?.email;
            const canOperate =
              user?.role === "admin" || ownedByCurrentUser || !item.owner_email;
            const busy = actionId === item.id;
            return (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.3) }}
                className="rounded-xl border border-red-100 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white">
                        <i className="fas fa-triangle-exclamation"></i>
                      </span>
                      <h3 className="text-lg font-bold text-gray-800">
                        {formatLabel(item.alert_type)}
                      </h3>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${severityClass(
                          item.severity,
                        )}`}
                      >
                        {formatLabel(item.severity)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                          item.status,
                        )}`}
                      >
                        {formatLabel(item.status)}
                      </span>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                        Escalation L{item.escalation_level || 1}
                      </span>
                    </div>

                    <p className="mb-4 leading-6 text-gray-700">{item.message}</p>

                    <div className="grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <span className="font-semibold text-gray-600">
                          Patient:
                        </span>{" "}
                        {item.patient_details?.name || item.patient_name}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">
                          Owner:
                        </span>{" "}
                        {item.owner_email || (
                          <strong className="text-red-600">Unassigned</strong>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">
                          State:
                        </span>{" "}
                        {formatLabel(item.operational_state)}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">
                          Emergency contact:
                        </span>{" "}
                        {item.patient_details?.emergency_contact || "N/A"}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">
                          Next review:
                        </span>{" "}
                        {formatDate(item.next_review_at)}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">
                          Created:
                        </span>{" "}
                        {formatDate(item.created_at)}
                      </div>
                    </div>

                    {item.events?.length > 0 && (
                      <details className="mt-4 rounded-lg border border-slate-200 p-3">
                        <summary className="cursor-pointer text-sm font-bold text-slate-700">
                          Response history ({item.events.length})
                        </summary>
                        <div className="mt-3 space-y-2">
                          {item.events.map((event) => (
                            <div
                              key={event.id}
                              className="border-l-2 border-violet-200 pl-3 text-sm text-slate-600"
                            >
                              <p className="font-semibold text-slate-800">
                                {formatLabel(event.event_type)} · L
                                {event.escalation_level}
                              </p>
                              <p>
                                {formatDate(event.created_at)}
                                {event.actor_email
                                  ? ` · ${event.actor_email}`
                                  : " · automated policy"}
                              </p>
                              {event.notes && <p>{event.notes}</p>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="flex min-w-36 flex-wrap gap-2 xl:flex-col">
                    {!item.owner_email && item.status !== "resolved" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => performAction(item.id, "claim")}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                      >
                        Claim
                      </button>
                    )}
                    {item.status === "active" && canOperate && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => performAction(item.id, "acknowledge")}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Acknowledge
                      </button>
                    )}
                    {item.status !== "resolved" &&
                      item.owner_email &&
                      canOperate && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => checkIn(item.id)}
                            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                          >
                            Check in
                          </button>
                          {(item.escalation_level || 1) < 3 && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => escalate(item.id)}
                              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                            >
                              Escalate
                            </button>
                          )}
                        </>
                      )}
                    {item.status !== "resolved" && canOperate && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => performAction(item.id, "resolve")}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmergencyAlerts;
