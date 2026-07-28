import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

const API_BASE_URL = "http://localhost:8000";

const eventTypeOptions = [
  { value: "all", label: "All Events" },
  { value: "medical_record", label: "Medical Records" },
  { value: "record_version", label: "Record Versions" },
  { value: "appointment", label: "Appointments" },
  { value: "prescription", label: "Prescriptions" },
  { value: "profile_update", label: "Profile Updates" },
  { value: "emergency_alert", label: "Emergency Alerts" },
  { value: "notification", label: "Notifications" },
];

const colorClasses = {
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-600",
  },
  green: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-600",
  },
  yellow: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
    dot: "bg-yellow-600",
  },
  red: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-600",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-600",
  },
  indigo: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-600",
  },
  orange: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-600",
  },
  gray: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-600",
  },
};

const formatDateTime = (value) => {
  if (!value) return "No date available";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const formatStatus = (value) => {
  if (!value) return "N/A";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const PatientHealthTimeline = ({ patientEmail = null, compact = false }) => {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [error, setError] = useState("");

  const loadTimeline = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      const url = patientEmail
        ? `${API_BASE_URL}/api/patients/${patientEmail}/timeline`
        : `${API_BASE_URL}/api/patients/me/timeline`;

      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setTimelineData(res.data);
    } catch (err) {
      console.error("Timeline load failed:", err.response?.data || err);
      setError(err.response?.data?.detail || "Failed to load patient timeline");
    } finally {
      setLoading(false);
    }
  };

  const deleteEmergencyAlert = async (alertId) => {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this emergency alert?"
  );

  if (!confirmDelete) return;

  try {
    const token = localStorage.getItem("access_token");

    await axios.delete(`${API_BASE_URL}/api/emergency-alerts/${alertId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    alert("Emergency alert deleted successfully.");
    loadTimeline();
  } catch (err) {
    console.error("Emergency alert delete failed:", err.response?.data || err);
    alert(err.response?.data?.detail || "Failed to delete emergency alert.");
  }
};

  useEffect(() => {
    loadTimeline();
  }, [patientEmail]);

  const filteredTimeline = useMemo(() => {
    const items = timelineData?.timeline || [];

    return items.filter((item) => {
      const matchesType =
        selectedType === "all" || item.event_type === selectedType;

      const lowerSearch = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !lowerSearch ||
        item.title?.toLowerCase().includes(lowerSearch) ||
        item.description?.toLowerCase().includes(lowerSearch) ||
        item.category?.toLowerCase().includes(lowerSearch) ||
        item.status?.toLowerCase().includes(lowerSearch);

      return matchesType && matchesSearch;
    });
  }, [timelineData, selectedType, searchTerm]);

  const renderMetadata = (metadata) => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return null;
    }

    return (
      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h5 className="text-sm font-bold text-gray-700 mb-3">Event Details</h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(metadata).map(([key, value]) => {
            if (
              value === null ||
              value === undefined ||
              value === "" ||
              typeof value === "object"
            ) {
              return null;
            }

            return (
              <div key={key} className="text-sm">
                <span className="font-semibold text-gray-600">
                  {formatStatus(key)}:
                </span>{" "}
                <span className="text-gray-700">{String(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimelineItem = (item, index) => {
    const colors = colorClasses[item.color] || colorClasses.gray;
    const isExpanded = expandedEventId === item.id;

    return (
      <motion.div
        key={item.id}
        className="relative pl-10 pb-8"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.4) }}
      >
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200"></div>

        <div
          className={`absolute left-0 top-2 w-8 h-8 ${colors.bg} rounded-full border-4 border-white shadow flex items-center justify-center z-10`}
        >
          <i
            className={`fas ${item.icon || "fa-circle"} ${colors.text} text-sm`}
          ></i>
        </div>

        <div
          className={`bg-white border ${colors.border} rounded-xl p-5 shadow-sm hover:shadow-md transition`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h4 className="font-bold text-gray-800">{item.title}</h4>

                <span
                  className={`${colors.bg} ${colors.text} px-3 py-1 rounded-full text-xs font-bold`}
                >
                  {formatStatus(item.status)}
                </span>

                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold">
                  {formatStatus(item.category)}
                </span>
              </div>

              <p className="text-gray-700 text-sm leading-6">
                {item.description || "No description available"}
              </p>

              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <i className="fas fa-clock"></i>
                {formatDateTime(item.date)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {item.event_type === "emergency_alert" &&
                item.metadata?.alert_id && (
                  <button
                    onClick={() => deleteEmergencyAlert(item.metadata.alert_id)}
                    className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    title="Delete emergency alert"
                  >
                    <i className="fas fa-trash mr-1"></i>
                    Delete
                  </button>
                )}

                <button
                  onClick={() =>
                    setExpandedEventId(isExpanded ? null : item.id)
                  }
                  className="text-gray-500 hover:text-blue-600 transition"
                  title="View details"
                >
                  <i
                    className={`fas ${
                      isExpanded ? "fa-chevron-up" : "fa-chevron-down"
                    }`}
                  ></i>
                </button>
            </div>
          </div>

          {isExpanded && renderMetadata(item.metadata)}
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-10 text-center">
        <i className="fas fa-spinner fa-spin text-blue-600 text-3xl mb-4"></i>
        <p className="text-gray-600">Loading patient health timeline...</p>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? ""
          : "bg-white rounded-xl shadow-lg border border-gray-100 p-6"
      }
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-timeline text-blue-600"></i>
            Patient Health Timeline
          </h2>

          <p className="text-sm text-gray-600 mt-1">
            Complete timeline of records, appointments, prescriptions, profile
            updates, and alerts.
          </p>
        </div>

        <button
          onClick={loadTimeline}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
        >
          <i className="fas fa-rotate-right"></i>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {timelineData?.patient && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-xl font-bold">{timelineData.patient.name}</h3>
              <p className="text-sm opacity-90">{timelineData.patient.email}</p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                Age: {timelineData.patient.age || "N/A"}
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                Blood: {timelineData.patient.blood_type || "N/A"}
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                Status: {formatStatus(timelineData.patient.status)}
              </span>
            </div>
          </div>
        </div>
      )}

      {timelineData?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-gray-600">Total Events</p>
            <p className="text-2xl font-bold text-blue-600">
              {timelineData.summary.total_events}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-sm text-gray-600">Records</p>
            <p className="text-2xl font-bold text-purple-600">
              {timelineData.summary.records_count}
            </p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-sm text-gray-600">Versions</p>
            <p className="text-2xl font-bold text-indigo-600">
              {timelineData.summary.record_versions_count}
            </p>
          </div>

          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-sm text-gray-600">Appointments</p>
            <p className="text-2xl font-bold text-green-600">
              {timelineData.summary.appointments_count}
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-sm text-gray-600">Prescriptions</p>
            <p className="text-2xl font-bold text-orange-600">
              {timelineData.summary.prescriptions_count}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
            <p className="text-sm text-gray-600">Unread</p>
            <p className="text-2xl font-bold text-yellow-600">
              {timelineData.summary.unread_notifications_count}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search timeline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {eventTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {filteredTimeline.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
          <i className="fas fa-timeline text-5xl text-gray-300 mb-4"></i>
          <p className="text-gray-600 font-semibold">
            No timeline events found
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Upload records, book appointments, or create prescriptions to build
            the timeline.
          </p>
        </div>
      ) : (
        <div className="relative">
          {filteredTimeline.map((item, index) =>
            renderTimelineItem(item, index),
          )}
        </div>
      )}
    </div>
  );
};

export default PatientHealthTimeline;
