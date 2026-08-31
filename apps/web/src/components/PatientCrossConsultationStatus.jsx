import React, { useEffect, useState } from "react";
import axios from "axios";

const statusClass = (status) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "accepted":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const PatientCrossConsultationStatus = () => {
  const [consults, setConsults] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConsults = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("access_token");

      const response = await axios.get("/api/cross-consultations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setConsults(response.data.referrals || []);
    } catch (error) {
      console.error("Patient cross consultations failed:", error.response?.data || error);
      setConsults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsults();
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border bg-white p-5">
        <p className="text-sm text-gray-500">Loading specialist consults...</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-purple-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          Specialist Consultations
        </h3>
        <p className="text-sm text-gray-500">
          Track specialist referrals requested by your doctor.
        </p>
      </div>

      {consults.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          No specialist consultations yet.
        </p>
      ) : (
        <div className="space-y-3">
          {consults.map((consult) => (
            <div
              key={consult.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="font-bold text-gray-900">
                    {consult.reason}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    Requested by Dr. {consult.requested_by_clinician_name}
                  </p>

                  <p className="text-sm text-gray-600">
                    Specialist: Dr. {consult.requested_to_clinician_name}
                    {consult.requested_to_specialization
                      ? ` · ${consult.requested_to_specialization}`
                      : ""}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(
                    consult.status
                  )}`}
                >
                  {consult.status}
                </span>
              </div>

              {consult.case_summary && (
                <p className="mt-3 text-sm text-gray-700">
                  <strong>Case Summary:</strong> {consult.case_summary}
                </p>
              )}

              {consult.specialist_notes && (
                <p className="mt-3 text-sm text-gray-700">
                  <strong>Specialist Notes:</strong> {consult.specialist_notes}
                </p>
              )}

              {consult.recommendation && (
                <p className="mt-2 text-sm text-gray-700">
                  <strong>Recommendation:</strong> {consult.recommendation}
                </p>
              )}

              {consult.created_at && (
                <p className="mt-3 text-xs text-gray-400">
                  Created: {new Date(consult.created_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default PatientCrossConsultationStatus;