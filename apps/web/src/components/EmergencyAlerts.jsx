import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

const API_BASE_URL = "http://localhost:8000";

const formatLabel = (value) => {
  if (!value) return "N/A";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDate = (value) => {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const EmergencyAlerts = ({ user }) => {
  const [alerts, setAlerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      const url =
        statusFilter === "all"
          ? `${API_BASE_URL}/api/emergency-alerts`
          : `${API_BASE_URL}/api/emergency-alerts?status=${statusFilter}`;

      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAlerts(res.data);
    } catch (err) {
      console.error("Emergency alerts load failed:", err.response?.data || err);
      setError(
        err.response?.data?.detail || "Failed to load emergency alerts.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  const acknowledgeAlert = async (alertId) => {
    try {
      const token = localStorage.getItem("access_token");

      await axios.put(
        `${API_BASE_URL}/api/emergency-alerts/${alertId}/acknowledge`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      loadAlerts();
    } catch (err) {
      console.error("Acknowledge failed:", err.response?.data || err);
      alert(err.response?.data?.detail || "Failed to acknowledge alert.");
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      const token = localStorage.getItem("access_token");

      await axios.put(
        `${API_BASE_URL}/api/emergency-alerts/${alertId}/resolve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      loadAlerts();
    } catch (err) {
      console.error("Resolve failed:", err.response?.data || err);
      alert(err.response?.data?.detail || "Failed to resolve alert.");
    }
  };

  const deleteAlert = async (alertId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this emergency alert?",
    );

    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("access_token");

      await axios.delete(`${API_BASE_URL}/api/emergency-alerts/${alertId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      loadAlerts();
    } catch (err) {
      console.error("Delete failed:", err.response?.data || err);
      alert(err.response?.data?.detail || "Failed to delete alert.");
    }
  };

  const summary = useMemo(() => {
    return {
      total: alerts.length,
      active: alerts.filter((item) => item.status === "active").length,
      acknowledged: alerts.filter((item) => item.status === "acknowledged")
        .length,
      resolved: alerts.filter((item) => item.status === "resolved").length,
      critical: alerts.filter((item) => item.severity === "critical").length,
    };
  }, [alerts]);

  const getSeverityClass = (severity) => {
    if (severity === "critical") {
      return "bg-red-100 text-red-700 border-red-200";
    }

    if (severity === "high") {
      return "bg-orange-100 text-orange-700 border-orange-200";
    }

    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  const getStatusClass = (status) => {
    if (status === "active") {
      return "bg-red-100 text-red-700";
    }

    if (status === "acknowledged") {
      return "bg-blue-100 text-blue-700";
    }

    if (status === "resolved") {
      return "bg-green-100 text-green-700";
    }

    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-triangle-exclamation text-red-600"></i>
            Emergency Alerts
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track and respond to patient emergency alerts.
          </p>
        </div>

        <button
          onClick={loadAlerts}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
        >
          <i className="fas fa-rotate-right"></i>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-gray-800">{summary.total}</p>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-red-600">{summary.active}</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-gray-600">Acknowledged</p>
          <p className="text-2xl font-bold text-blue-600">
            {summary.acknowledged}
          </p>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-sm text-gray-600">Resolved</p>
          <p className="text-2xl font-bold text-green-600">
            {summary.resolved}
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-sm text-gray-600">Critical</p>
          <p className="text-2xl font-bold text-orange-600">
            {summary.critical}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="all">All Alerts</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <i className="fas fa-spinner fa-spin text-red-600 text-3xl mb-4"></i>
          <p className="text-gray-600">Loading emergency alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
          <i className="fas fa-shield-heart text-5xl text-gray-300 mb-4"></i>
          <p className="text-gray-600 font-semibold">
            No emergency alerts found
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Emergency alerts will appear here when patients trigger them.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alertItem, index) => (
            <motion.div
              key={alertItem.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.3) }}
              className="border border-red-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="bg-red-600 text-white w-9 h-9 rounded-full flex items-center justify-center">
                      <i className="fas fa-triangle-exclamation"></i>
                    </span>

                    <h3 className="text-lg font-bold text-gray-800">
                      {formatLabel(alertItem.alert_type)}
                    </h3>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityClass(
                        alertItem.severity,
                      )}`}
                    >
                      {formatLabel(alertItem.severity)}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusClass(
                        alertItem.status,
                      )}`}
                    >
                      {formatLabel(alertItem.status)}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-4 leading-6">
                    {alertItem.message}
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold text-gray-600">
                        Patient:
                      </span>{" "}
                      {alertItem.patient_details?.name ||
                        alertItem.patient_name}
                    </div>

                    <div>
                      <span className="font-semibold text-gray-600">
                        Email:
                      </span>{" "}
                      {alertItem.patient_email}
                    </div>

                    <div>
                      <span className="font-semibold text-gray-600">Age:</span>{" "}
                      {alertItem.patient_details?.age || "N/A"}
                    </div>

                    <div>
                      <span className="font-semibold text-gray-600">
                        Blood Type:
                      </span>{" "}
                      {alertItem.patient_details?.blood_type || "N/A"}
                    </div>

                    <div>
                      <span className="font-semibold text-gray-600">
                        Emergency Contact:
                      </span>{" "}
                      {alertItem.patient_details?.emergency_contact || "N/A"}
                    </div>

                    <div>
                      <span className="font-semibold text-gray-600">
                        Created:
                      </span>{" "}
                      {formatDate(alertItem.created_at)}
                    </div>

                    {alertItem.acknowledged_by && (
                      <div>
                        <span className="font-semibold text-gray-600">
                          Acknowledged By:
                        </span>{" "}
                        {alertItem.acknowledged_by}
                      </div>
                    )}

                    {alertItem.resolved_by && (
                      <div>
                        <span className="font-semibold text-gray-600">
                          Resolved By:
                        </span>{" "}
                        {alertItem.resolved_by}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {alertItem.status === "active" &&
                    user?.role !== "patient" && (
                      <button
                        onClick={() => acknowledgeAlert(alertItem.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Acknowledge
                      </button>
                    )}

                  {alertItem.status !== "resolved" &&
                    user?.role !== "patient" && (
                      <button
                        onClick={() => resolveAlert(alertItem.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Resolve
                      </button>
                    )}

                  {["patient", "clinician", "admin"].includes(user?.role) && (
                    <button
                      onClick={() => deleteAlert(alertItem.id)}
                      className="bg-gray-100 hover:bg-gray-200 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmergencyAlerts;
