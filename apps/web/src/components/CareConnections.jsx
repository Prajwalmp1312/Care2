import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const CareConnections = ({
  user,
  onOpenConversation,
  onConnectionsChanged,
}) => {
  const [clinicians, setClinicians] = useState([]);
  const [requests, setRequests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadData = async () => {
    try {
      setFeedback(null);
      if (user?.role === "patient") {
        const [clinicianResponse, requestResponse, conversationResponse] =
          await Promise.all([
            axios.get("/api/clinicians"),
            axios.get("/api/message-requests"),
            axios.get("/api/conversations"),
          ]);
        setClinicians(clinicianResponse.data.clinicians || []);
        setRequests(requestResponse.data.requests || []);
        setConversations(conversationResponse.data.conversations || []);
      } else if (user?.role === "clinician") {
        const [requestResponse, conversationResponse] = await Promise.all([
          axios.get("/api/message-requests"),
          axios.get("/api/conversations"),
        ]);
        setRequests(requestResponse.data.requests || []);
        setConversations(conversationResponse.data.conversations || []);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.detail || "Unable to load care connections.",
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role]);

  const filteredClinicians = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clinicians;
    return clinicians.filter((clinician) =>
      [
        clinician.name,
        clinician.specialization,
        clinician.department,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [clinicians, search]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || user?.role !== "clinician") return requests;
    return requests.filter((request) =>
      [request.patient_name, request.patient_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [requests, search, user?.role]);

  const requestMessageAccess = async (clinicianEmail) => {
    try {
      setBusyId(clinicianEmail);
      setFeedback(null);
      await axios.post("/api/message-requests", {
        clinician_email: clinicianEmail,
      });
      await loadData();
      onConnectionsChanged?.();
      setFeedback({
        type: "success",
        message: "Your message request was sent to the clinician.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.detail || "Unable to send the request.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      setBusyId(requestId);
      setFeedback(null);
      await axios.put(`/api/message-requests/${requestId}/${action}`, {});
      await loadData();
      onConnectionsChanged?.();
      setFeedback({
        type: "success",
        message:
          action === "accept"
            ? "The patient was added to your conversations."
            : "The message request was declined.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.detail || "Unable to update the request.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const requestStatus = (clinicianEmail) =>
    requests
      .filter((request) => request.clinician_email === clinicianEmail)
      .sort(
        (first, second) =>
          new Date(second.requested_at) - new Date(first.requested_at),
      )[0];

  const connectedConversation = (clinicianEmail) =>
    conversations.find(
      (conversation) => conversation.other_user_email === clinicianEmail,
    );

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 p-6 text-white shadow-lg">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <i
            className={`fas ${
              user?.role === "patient" ? "fa-user-doctor" : "fa-user-plus"
            }`}
          ></i>
          {user?.role === "patient"
            ? "Find Care & Manage Requests"
            : "Patient Message Requests"}
        </h2>
        <p className="mt-2 text-white/85">
          {user?.role === "patient"
            ? "Find the right clinician, request a secure conversation, and track approval in one place."
            : "Review new patient connection requests before they become conversations."}
        </p>
      </div>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-lg border p-4 text-sm font-medium ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="relative">
        <i className="fas fa-search absolute left-4 top-3.5 text-slate-400"></i>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            user?.role === "patient"
              ? "Search by clinician, specialty, or department..."
              : "Search patient requests..."
          }
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {user?.role === "patient" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Clinician directory
                </h3>
                <p className="text-sm text-slate-500">
                  {filteredClinicians.length} approved clinician
                  {filteredClinicians.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredClinicians.map((clinician) => {
                const conversation = connectedConversation(clinician.email);
                const latestRequest = requestStatus(clinician.email);
                const pending = latestRequest?.status === "pending";
                return (
                  <article
                    key={clinician.id}
                    className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <i className="fas fa-user-doctor text-lg"></i>
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900">
                          {clinician.name}
                        </h4>
                        <p className="text-sm font-medium text-blue-700">
                          {clinician.specialization || "General care"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {clinician.department || "Clinical Services"} ·{" "}
                          {clinician.years_of_experience || 0} years
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      {conversation ? (
                        <button
                          type="button"
                          onClick={() => onOpenConversation?.(conversation)}
                          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
                        >
                          <i className="fas fa-comments mr-2"></i>
                          Open conversation
                        </button>
                      ) : pending ? (
                        <button
                          type="button"
                          disabled
                          className="w-full cursor-not-allowed rounded-lg bg-amber-100 px-4 py-2.5 font-semibold text-amber-800"
                        >
                          <i className="fas fa-clock mr-2"></i>
                          Request pending
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === clinician.email}
                          onClick={() => requestMessageAccess(clinician.email)}
                          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          <i className="fas fa-paper-plane mr-2"></i>
                          {latestRequest?.status === "rejected"
                            ? "Request again"
                            : "Request conversation"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {filteredClinicians.length === 0 && (
                <div className="col-span-full rounded-lg bg-slate-50 py-10 text-center text-slate-500">
                  No clinicians match your search.
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-xl border border-slate-100 bg-white p-5 shadow-md">
            <h3 className="text-xl font-bold text-slate-900">My requests</h3>
            <p className="mt-1 text-sm text-slate-500">
              Conversation access requests and their status.
            </p>
            <div className="mt-4 space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {request.clinician_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {request.clinician_specialization || "Clinical care"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${
                        request.status === "accepted"
                          ? "bg-emerald-100 text-emerald-700"
                          : request.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Requested{" "}
                    {new Date(request.requested_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {requests.length === 0 && (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  You have not sent any conversation requests.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Pending patient requests
              </h3>
              <p className="text-sm text-slate-500">
                Accepting a request creates a secure conversation.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
              {filteredRequests.length} pending
            </span>
          </div>
          <div className="space-y-3">
            {filteredRequests.map((request) => (
              <article
                key={request.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <i className="fas fa-user"></i>
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">
                      {request.patient_name}
                    </h4>
                    <p className="text-sm text-slate-500">
                      {request.patient_email}
                    </p>
                    <p className="text-xs text-slate-400">
                      Requested{" "}
                      {new Date(request.requested_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => respondToRequest(request.id, "reject")}
                    className="rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => respondToRequest(request.id, "accept")}
                    className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Accept
                  </button>
                </div>
              </article>
            ))}
            {filteredRequests.length === 0 && (
              <div className="rounded-lg bg-slate-50 py-10 text-center text-slate-500">
                <i className="fas fa-circle-check mb-2 text-3xl text-emerald-500"></i>
                <p>No pending patient requests.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default CareConnections;
