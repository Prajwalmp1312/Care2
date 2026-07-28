import React, { useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

const EmergencyAlertButton = ({ onAlertCreated }) => {
  const [showModal, setShowModal] = useState(false);
  const [alertType, setAlertType] = useState("medical_emergency");
  const [severity, setSeverity] = useState("high");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const triggerAlert = async () => {
    if (!message.trim()) {
      setError("Please enter emergency details.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const token = localStorage.getItem("access_token");

      await axios.post(
        `${API_BASE_URL}/api/emergency-alerts`,
        {
          alert_type: alertType,
          severity,
          message: message.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Emergency alert sent successfully.");

      setShowModal(false);
      setAlertType("medical_emergency");
      setSeverity("high");
      setMessage("");

      if (onAlertCreated) {
        onAlertCreated();
      }
    } catch (err) {
      console.error("Emergency alert failed:", err.response?.data || err);
      setError(err.response?.data?.detail || "Failed to send emergency alert.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition"
      >
        <i className="fas fa-triangle-exclamation"></i>
        Emergency Alert
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-red-600 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <i className="fas fa-triangle-exclamation"></i>
                  Trigger Emergency Alert
                </h3>
                <p className="text-sm opacity-90 mt-1">
                  This will notify connected clinicians and admins.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-red-100"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
                Use this only for urgent medical situations. If this is a real emergency,
                call your local emergency number immediately.
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Emergency Type
                </label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="medical_emergency">Medical Emergency</option>
                  <option value="severe_pain">Severe Pain</option>
                  <option value="breathing_issue">Breathing Issue</option>
                  <option value="accident">Accident</option>
                  <option value="medication_reaction">Medication Reaction</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Emergency Details
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Example: I am experiencing severe chest pain and dizziness."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  onClick={triggerAlert}
                  disabled={submitting}
                  className="px-5 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Emergency Alert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmergencyAlertButton;