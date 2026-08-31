import React, { useEffect, useMemo, useState } from "react";
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

const priorityClass = (priority) => {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "normal":
      return "bg-blue-100 text-blue-800";
    case "low":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const DoctorCrossConsultSearch = ({ user }) => {
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("all");
  const [doctors, setDoctors] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientRecords, setPatientRecords] = useState([]);
  const [referrals, setReferrals] = useState([]);

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [specialistDrafts, setSpecialistDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [formData, setFormData] = useState({
    patient_email: "",
    requested_to_clinician_email: "",
    reason: "",
    case_summary: "",
    priority: "normal",
    attached_record_ids: [],
  });

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem("access_token");

    return {
      Authorization: `Bearer ${token}`,
    };
  }, []);

  useEffect(() => {
    loadDoctors();
    loadSpecializations();
    loadPatients();
    loadReferrals();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);

      const response = await axios.get("/api/referral/clinicians", {
        headers: authHeaders,
        params: {
          search,
          specialization,
        },
      });

      setDoctors(response.data.clinicians || []);
    } catch (error) {
      console.error("Doctor search failed:", error.response?.data || error);
      setDoctors([]);
      setFeedback({
        type: "error",
        message: error.response?.data?.detail || "Unable to load doctors.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSpecializations = async () => {
    try {
      const response = await axios.get("/api/referral/specializations", {
        headers: authHeaders,
      });

      setSpecializations(response.data.specializations || []);
    } catch (error) {
      console.error(
        "Specializations load failed:",
        error.response?.data || error,
      );
      setSpecializations([]);
    }
  };

  const loadPatients = async () => {
    try {
      const response = await axios.get("/api/referral/my-patients", {
        headers: authHeaders,
      });

      setPatients(response.data.patients || []);
    } catch (error) {
      console.error("Patients load failed:", error.response?.data || error);
      setPatients([]);
    }
  };

  const loadPatientRecords = async (patientEmail) => {
    if (!patientEmail) {
      setPatientRecords([]);
      return;
    }

    try {
      const response = await axios.get("/api/referral/patient-records", {
        headers: authHeaders,
        params: {
          patient_email: patientEmail,
        },
      });

      setPatientRecords(response.data.records || []);
    } catch (error) {
      console.error(
        "Patient records load failed:",
        error.response?.data || error,
      );
      setPatientRecords([]);
      setFeedback({
        type: "error",
        message:
          error.response?.data?.detail ||
          "Unable to load patient records for attachment.",
      });
    }
  };

  const loadReferrals = async () => {
    try {
      const response = await axios.get("/api/cross-consultations", {
        headers: authHeaders,
      });

      setReferrals(response.data.referrals || []);
    } catch (error) {
      console.error("Referrals load failed:", error.response?.data || error);
      setReferrals([]);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSpecialization("all");
    setTimeout(() => {
      loadDoctors();
    }, 0);
  };

  const openReferralModal = (doctor) => {
    setSelectedDoctor(doctor);
    setPatientRecords([]);
    setFeedback(null);

    setFormData({
      patient_email: "",
      requested_to_clinician_email: doctor.email,
      reason: "",
      case_summary: "",
      priority: "normal",
      attached_record_ids: [],
    });

    setShowModal(true);
  };

  const closeReferralModal = () => {
    setShowModal(false);
    setSelectedDoctor(null);
    setPatientRecords([]);

    setFormData({
      patient_email: "",
      requested_to_clinician_email: "",
      reason: "",
      case_summary: "",
      priority: "normal",
      attached_record_ids: [],
    });
  };

  const submitReferral = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setFeedback(null);

      await axios.post("/api/cross-consultations", formData, {
        headers: authHeaders,
      });

      setFeedback({
        type: "success",
        message: "Cross consultation referral sent successfully.",
      });

      closeReferralModal();
      loadReferrals();
    } catch (error) {
      console.error("Referral failed:", error.response?.data || error);

      setFeedback({
        type: "error",
        message: error.response?.data?.detail || "Unable to send referral.",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateReferralStatus = async (referralId, status) => {
    try {
      setLoading(true);
      setFeedback(null);

      await axios.put(
        `/api/cross-consultations/${referralId}`,
        {
          status,
          response_notes:
            status === "accepted"
              ? "Consultation request accepted."
              : status === "rejected"
                ? "Consultation request rejected."
                : "Consultation completed.",
          recommendation:
            status === "completed"
              ? "Specialist review completed. Please check detailed notes."
              : "",
          specialist_notes: "",
        },
        {
          headers: authHeaders,
        },
      );

      setFeedback({
        type: "success",
        message: `Referral ${status} successfully.`,
      });

      loadReferrals();
    } catch (error) {
      console.error("Referral update failed:", error.response?.data || error);

      setFeedback({
        type: "error",
        message: error.response?.data?.detail || "Unable to update referral.",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateReferralWithNotes = async (referral, status) => {
    try {
      setLoading(true);
      setFeedback(null);

      const draft = specialistDrafts[referral.id] || {};

      await axios.put(
        `/api/cross-consultations/${referral.id}`,
        {
          status,
          response_notes: draft.response_notes || referral.response_notes || "",
          recommendation: draft.recommendation || referral.recommendation || "",
          specialist_notes:
            draft.specialist_notes || referral.specialist_notes || "",
        },
        {
          headers: authHeaders,
        },
      );

      setFeedback({
        type: "success",
        message: `Consultation ${status} successfully.`,
      });

      loadReferrals();
    } catch (error) {
      console.error(
        "Specialist notes update failed:",
        error.response?.data || error,
      );

      setFeedback({
        type: "error",
        message:
          error.response?.data?.detail || "Unable to update consultation.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAttachedRecord = async (recordId, fileName) => {
    try {
      const token = localStorage.getItem("access_token");

      console.log("Downloading record:", recordId, fileName);

      const response = await axios.get(
        `/api/medical-records/${recordId}/download`,
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const contentType = response.headers["content-type"] || "application/pdf";

      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "medical_record.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);

      let message = "Unable to download medical record.";

      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed.detail || message;
        } catch {
          message = "Download failed. Check backend terminal.";
        }
      } else if (error.response?.data?.detail) {
        message = error.response.data.detail;
      }

      alert(message);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-700 p-8 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <i className="fas fa-user-md text-3xl"></i>
          <div>
            <h2 className="text-3xl font-bold">
              Doctor Search for Cross Consultation
            </h2>
            <p className="mt-2 text-purple-100">
              Find doctors by name, specialization, or department and refer your
              patient for a specialist opinion.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Search doctor
            </label>

            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Doctor name, specialization, or department..."
                className="w-full rounded-xl border border-gray-300 px-12 py-4 text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Specialization
            </label>

            <select
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-4 text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
            >
              <option value="all">All specializations</option>

              {specializations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadDoctors}
            disabled={loading}
            className="rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fas fa-search mr-2"></i>
            Search doctors
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
      </section>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-sm font-semibold ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
          <div className="mb-5">
            <h3 className="text-2xl font-bold text-gray-900">Doctor results</h3>
            <p className="text-sm text-gray-500">
              {doctors.length} matching doctors
            </p>
          </div>

          {doctors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No doctors found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {doctors.map((doctor) => (
                <div
                  key={doctor.email}
                  className="rounded-xl border border-gray-200 p-5 transition hover:border-purple-200 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                      <i className="fas fa-user-md"></i>
                    </div>

                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">
                        Dr. {doctor.name}
                      </h4>

                      <p className="text-sm text-purple-700">
                        {doctor.specialization || "General care"}
                      </p>

                      <p className="text-sm text-gray-500">
                        {doctor.department || "Clinical Services"}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        {doctor.years_of_experience || 0} years experience
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {doctor.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openReferralModal(doctor)}
                    className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    Refer Patient
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
          <div className="mb-5">
            <h3 className="text-2xl font-bold text-gray-900">
              My cross referrals
            </h3>
            <p className="text-sm text-gray-500">
              Referrals you sent or received.
            </p>
          </div>

          {referrals.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              No cross consultation referrals yet.
            </p>
          ) : (
            <div className="max-h-[48rem] space-y-4 overflow-y-auto pr-1">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">
                        {referral.patient_name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {referral.patient_email}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${statusClass(
                        referral.status,
                      )}`}
                    >
                      {referral.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-gray-700">
                    {referral.direction === "received" ? (
                      <p>
                        <strong>From:</strong> Dr.{" "}
                        {referral.requested_by_clinician_name}
                      </p>
                    ) : (
                      <p>
                        <strong>To:</strong> Dr.{" "}
                        {referral.requested_to_clinician_name}
                      </p>
                    )}

                    <p>
                      <strong>Reason:</strong> {referral.reason}
                    </p>

                    {referral.case_summary && (
                      <p>
                        <strong>Case Summary:</strong> {referral.case_summary}
                      </p>
                    )}

                    {referral.priority && (
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold capitalize ${priorityClass(
                          referral.priority,
                        )}`}
                      >
                        {referral.priority}
                      </span>
                    )}

                    {referral.attached_records?.length > 0 && (
                      <div className="mt-3 rounded-xl bg-blue-50 p-4">
                        <p className="mb-3 text-base font-bold text-blue-900">
                          Attached Records
                        </p>

                        <div className="space-y-3">
                          {referral.attached_records.map((record) => {
                            const fileName =
                              record.file_name ||
                              record.name ||
                              "medical_record.pdf";

                            return (
                              <div
                                key={record.id}
                                className="rounded-xl border border-blue-100 bg-white p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm font-bold text-gray-900">
                                      {fileName}
                                    </p>

                                    <p className="text-xs text-gray-500">
                                      {record.type ||
                                        record.record_type ||
                                        "Medical Report"}{" "}
                                      · {record.category || "Other"}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDownloadAttachedRecord(
                                        record.id,
                                        fileName,
                                      )
                                    }
                                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                                  >
                                    <i className="fas fa-download mr-1"></i>
                                    Download PDF
                                  </button>
                                </div>

                                {record.analysis_summary && (
                                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                                    {record.analysis_summary}
                                  </p>
                                )}

                                {record.key_findings?.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs font-bold text-gray-600">
                                      Key findings:
                                    </p>
                                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-600">
                                      {record.key_findings.map(
                                        (finding, index) => (
                                          <li key={index}>{finding}</li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {referral.specialist_notes && (
                      <p>
                        <strong>Specialist Notes:</strong>{" "}
                        {referral.specialist_notes}
                      </p>
                    )}

                    {referral.recommendation && (
                      <p>
                        <strong>Recommendation:</strong>{" "}
                        {referral.recommendation}
                      </p>
                    )}

                    <p>
                      <strong>Type:</strong>{" "}
                      {referral.direction === "received"
                        ? "Received request"
                        : "Sent referral"}
                    </p>
                  </div>

                  {referral.direction === "received" &&
                    ["pending", "accepted"].includes(referral.status) && (
                      <div className="mt-4 space-y-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                        <p className="text-sm font-bold text-purple-900">
                          Specialist Response
                        </p>

                        <textarea
                          rows={3}
                          value={
                            specialistDrafts[referral.id]?.specialist_notes ??
                            referral.specialist_notes ??
                            ""
                          }
                          onChange={(event) =>
                            setSpecialistDrafts({
                              ...specialistDrafts,
                              [referral.id]: {
                                ...(specialistDrafts[referral.id] || {}),
                                specialist_notes: event.target.value,
                              },
                            })
                          }
                          placeholder="Add specialist notes after reviewing attached reports..."
                          className="w-full rounded-lg border border-purple-200 px-3 py-2 text-sm"
                        />

                        <textarea
                          rows={2}
                          value={
                            specialistDrafts[referral.id]?.recommendation ??
                            referral.recommendation ??
                            ""
                          }
                          onChange={(event) =>
                            setSpecialistDrafts({
                              ...specialistDrafts,
                              [referral.id]: {
                                ...(specialistDrafts[referral.id] || {}),
                                recommendation: event.target.value,
                              },
                            })
                          }
                          placeholder="Add recommendation for referring doctor..."
                          className="w-full rounded-lg border border-purple-200 px-3 py-2 text-sm"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            updateReferralWithNotes(referral, "accepted")
                          }
                          className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                        >
                          Save Specialist Notes
                        </button>
                      </div>
                    )}

                  {referral.direction === "received" &&
                    referral.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateReferralStatus(referral.id, "accepted")
                          }
                          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Accept
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateReferralStatus(referral.id, "rejected")
                          }
                          className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                  {referral.direction === "received" &&
                    referral.status === "accepted" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateReferralWithNotes(referral, "completed")
                        }
                        className="mt-4 w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        Mark Completed
                      </button>
                    )}

                  {referral.created_at && (
                    <p className="mt-3 text-xs text-gray-400">
                      {new Date(referral.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showModal && selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Refer Patient
                </h3>
                <p className="text-sm text-gray-500">
                  Refer patient to Dr. {selectedDoctor.name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeReferralModal}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={submitReferral} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Select patient
                </label>

                <select
                  required
                  value={formData.patient_email}
                  onChange={(event) => {
                    const patientEmail = event.target.value;

                    setFormData({
                      ...formData,
                      patient_email: patientEmail,
                      attached_record_ids: [],
                    });

                    loadPatientRecords(patientEmail);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                >
                  <option value="">Choose patient</option>

                  {patients.map((patient) => (
                    <option key={patient.email} value={patient.email}>
                      {patient.name} - {patient.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Reason for consultation
                </label>

                <input
                  required
                  type="text"
                  value={formData.reason}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      reason: event.target.value,
                    })
                  }
                  placeholder="Example: Cardiology opinion needed"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Case summary
                </label>

                <textarea
                  rows={4}
                  value={formData.case_summary}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      case_summary: event.target.value,
                    })
                  }
                  placeholder="Briefly explain patient case, symptoms, and what specialist should review..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Attach patient records
                </label>

                {patientRecords.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                    Select a patient to load available medical records.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
                    {patientRecords.map((record) => {
                      const checked = formData.attached_record_ids.includes(
                        record.id,
                      );

                      return (
                        <label
                          key={record.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextIds = event.target.checked
                                ? [...formData.attached_record_ids, record.id]
                                : formData.attached_record_ids.filter(
                                    (id) => id !== record.id,
                                  );

                              setFormData({
                                ...formData,
                                attached_record_ids: nextIds,
                              });
                            }}
                            className="mt-1"
                          />

                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {record.file_name || record.name}
                            </p>

                            <p className="text-xs text-gray-500">
                              {record.type ||
                                record.record_type ||
                                "Medical Report"}{" "}
                              · {record.category || "Other"}
                            </p>

                            {record.analysis_summary && (
                              <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                                {record.analysis_summary}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Priority
                </label>

                <select
                  value={formData.priority}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      priority: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeReferralModal}
                  className="rounded-lg border border-gray-300 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-purple-600 px-5 py-2 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorCrossConsultSearch;
