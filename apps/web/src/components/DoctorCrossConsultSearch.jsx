import React, { useEffect, useState } from "react";
import axios from "axios";

const DoctorCrossConsultSearch = ({ user }) => {
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("all");
  const [doctors, setDoctors] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [referrals, setReferrals] = useState([]);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const [formData, setFormData] = useState({
    patient_email: "",
    requested_to_clinician_email: "",
    reason: "",
    case_summary: "",
    priority: "normal",
  });

  const authHeaders = {
    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
  };

  const loadDoctors = async () => {
    try {
      setLoading(true);
      setFeedback(null);

      const response = await axios.get("/api/referral/clinicians", {
        headers: authHeaders,
        params: {
          search: search || undefined,
          specialization: specialization !== "all" ? specialization : undefined,
        },
      });

      setDoctors(response.data.clinicians || []);
    } catch (error) {
      console.error("Doctor search failed:", error);
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
      console.error("Specializations failed:", error);
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
      console.error("Patients load failed:", error);
      setPatients([]);
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

  useEffect(() => {
    if (user?.role !== "clinician") return;

    loadDoctors();
    loadSpecializations();
    loadPatients();
    loadReferrals();
  }, [user?.role]);

  const searchDoctors = (event) => {
    event.preventDefault();
    loadDoctors();
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

    setFormData({
      patient_email: "",
      requested_to_clinician_email: doctor.email,
      reason: "",
      case_summary: "",
      priority: "normal",
    });

    setShowModal(true);
  };

  const closeReferralModal = () => {
    setShowModal(false);
    setSelectedDoctor(null);
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
      console.error("Referral failed:", error);
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

  const statusClass = (status) => {
    if (status === "completed") return "bg-green-100 text-green-700";
    if (status === "accepted") return "bg-blue-100 text-blue-700";
    if (status === "rejected") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  if (user?.role !== "clinician") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold">
          <i className="fas fa-user-doctor mr-3"></i>
          Doctor Search for Cross Consultation
        </h2>

        <p className="mt-1 text-sm text-purple-100">
          Find doctors by name, specialization, or department and refer your
          patient for a specialist opinion.
        </p>
      </div>

      <form
        onSubmit={searchDoctors}
        className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Search doctor
            </label>

            <div className="relative">
              <i className="fas fa-search absolute left-3 top-3.5 text-gray-400"></i>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Doctor name, specialization, or department..."
                className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Specialization
            </label>

            <select
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3"
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

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Searching...
              </>
            ) : (
              <>
                <i className="fas fa-search mr-2"></i>
                Search doctors
              </>
            )}
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
      </form>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-sm font-semibold ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg">
          <div className="mb-5">
            <h3 className="text-xl font-bold text-gray-900">Doctor results</h3>
            <p className="text-sm text-gray-500">
              {doctors.length} matching doctor{doctors.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {doctors.map((doctor) => (
              <article
                key={doctor.id}
                className="rounded-xl border border-gray-200 p-4 transition hover:border-purple-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                    <i className="fas fa-user-doctor text-lg"></i>
                  </span>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-gray-900 break-words">
                      Dr. {doctor.name}
                    </h4>

                    <p className="text-sm font-semibold text-purple-700">
                      {doctor.specialization || "General care"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {doctor.department || "Clinical Services"} ·{" "}
                      {doctor.years_of_experience || 0} years experience
                    </p>

                    <p className="mt-1 text-xs text-gray-400 break-words">
                      {doctor.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openReferralModal(doctor)}
                  className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-2.5 font-semibold text-white hover:bg-purple-700"
                >
                  <i className="fas fa-share mr-2"></i>
                  Refer Patient
                </button>
              </article>
            ))}

            {!loading && doctors.length === 0 && (
              <div className="col-span-full rounded-lg bg-gray-50 py-10 text-center text-gray-500">
                No doctors match your search.
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900">
            My cross referrals
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Referrals you sent or received.
          </p>

          <div className="mt-5 space-y-3">
            {referrals.map((referral) => (
              <div
                key={referral.id}
                className="rounded-lg border border-gray-200 p-4"
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

                <div className="mt-3 space-y-1 text-sm text-gray-700">
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

                  <p>
                    <strong>Type:</strong>{" "}
                    {referral.direction === "received"
                      ? "Received request"
                      : "Sent referral"}
                  </p>
                </div>

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
                        updateReferralStatus(referral.id, "completed")
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

            {referrals.length === 0 && (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                No cross consultation referrals yet.
              </p>
            )}
          </div>
        </aside>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Refer Patient
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Refer patient to Dr. {selectedDoctor?.name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeReferralModal}
                className="text-gray-400 hover:text-gray-700"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={submitReferral} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Select patient
                </label>

                <select
                  value={formData.patient_email}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      patient_email: event.target.value,
                    })
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                >
                  <option value="">Choose patient</option>
                  {patients.map((patient) => (
                    <option key={patient.email} value={patient.email}>
                      {patient.name} ({patient.email})
                    </option>
                  ))}
                </select>

                {patients.length === 0 && (
                  <p className="mt-2 text-xs text-red-600">
                    No connected patients found. Accept a patient request or
                    create an appointment first.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Reason
                </label>

                <input
                  value={formData.reason}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      reason: event.target.value,
                    })
                  }
                  required
                  placeholder="Example: Need cardiology opinion"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Case summary
                </label>

                <textarea
                  value={formData.case_summary}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      case_summary: event.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Add symptoms, findings, diagnosis, reports, or reason for referral..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />
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
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeReferralModal}
                  className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    loading || !formData.patient_email || !formData.reason
                  }
                  className="rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
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
