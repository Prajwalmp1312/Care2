import React from "react";
import VideoConsultationButton from "./VideoConsultationButton";

const STATUS_STEPS = ["pending", "approved", "completed"];

const typeDetails = {
  phone_call: { label: "Phone Call", icon: "fa-phone", color: "text-sky-700" },
  video_call: { label: "Video Call", icon: "fa-video", color: "text-violet-700" },
  in_person: {
    label: "In Person",
    icon: "fa-hospital-user",
    color: "text-emerald-700",
  },
};

const statusClasses = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-slate-100 text-slate-700",
};

const formatAppointmentDate = (dateValue, timeValue) => {
  const date = new Date(`${dateValue}T${timeValue || "12:00"}`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const AppointmentDetailsDrawer = ({
  appointment,
  user,
  notes,
  busy,
  message,
  error,
  patientSummary,
  patientSummaryLoading,
  patientSummaryError,
  onClose,
  onNotesChange,
  onSaveNotes,
  onStatusChange,
  onDelete,
  onOpenPatientProfile,
  onMessagePatient,
}) => {
  if (!appointment) return null;

  const type =
    typeDetails[appointment.appointment_type] || typeDetails.in_person;
  const participant =
    user?.role === "patient"
      ? {
          label: "Clinician",
          name: `Dr. ${appointment.clinician_name}`,
          detail: appointment.clinician_specialization || "General",
          icon: "fa-user-doctor",
        }
      : {
          label: "Patient",
          name: appointment.patient_name,
          detail: appointment.patient_email,
          icon: "fa-user",
        };
  const currentStep = STATUS_STEPS.indexOf(appointment.status);
  const canEditNotes = ["clinician", "admin"].includes(user?.role);
  const canDelete =
    user?.role === "admin" ||
    (user?.role === "patient" &&
      ["cancelled", "rejected"].includes(appointment.status));

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-slate-950/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-drawer-title"
      onMouseDown={onClose}
    >
      <aside
        className="flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-100">
                Appointment #{appointment.id}
              </p>
              <h2
                id="appointment-drawer-title"
                className="mt-1 text-2xl font-bold"
              >
                Appointment details
              </h2>
              <p className="mt-2 text-blue-100">
                {formatAppointmentDate(
                  appointment.appointment_date,
                  appointment.appointment_time,
                )}{" "}
                at {appointment.appointment_time}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              aria-label="Close appointment details"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                statusClasses[appointment.status] || statusClasses.cancelled
              }`}
            >
              {appointment.status}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
              <i className={`fas ${type.icon} ${type.color} mr-2`}></i>
              {type.label}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
              <i className="fas fa-clock mr-2 text-slate-500"></i>
              {appointment.consultation_duration_minutes || 15} minutes
            </span>
          </div>

          {(message || error) && (
            <div
              role={error ? "alert" : "status"}
              className={`rounded-xl border p-3 text-sm font-medium ${
                error
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <i
                className={`fas ${
                  error ? "fa-circle-exclamation" : "fa-circle-check"
                } mr-2`}
              ></i>
              {error || message}
            </div>
          )}

          {["rejected", "cancelled"].includes(appointment.status) ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <i className="fas fa-circle-xmark mr-2"></i>
              This appointment was {appointment.status}.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                Appointment progress
              </p>
              <div className="flex items-start">
                {STATUS_STEPS.map((step, index) => {
                  const complete = currentStep >= index;
                  return (
                    <React.Fragment key={step}>
                      <div className="flex min-w-20 flex-col items-center text-center">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                            complete
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {complete ? (
                            <i className="fas fa-check"></i>
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={`mt-2 text-xs font-semibold capitalize ${
                            complete ? "text-blue-700" : "text-slate-400"
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                      {index < STATUS_STEPS.length - 1 && (
                        <span
                          className={`mt-4 h-0.5 flex-1 ${
                            currentStep > index ? "bg-blue-600" : "bg-slate-200"
                          }`}
                        ></span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {participant.label}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <i className={`fas ${participant.icon}`}></i>
              </span>
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{participant.name}</p>
                <p className="truncate text-sm text-slate-500">
                  {participant.detail}
                </p>
              </div>
            </div>
          </section>

          {["clinician", "admin"].includes(user?.role) && (
            <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                    Patient at a glance
                  </p>
                  <p className="mt-1 text-sm text-blue-900">
                    A minimum summary for appointment preparation.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onOpenPatientProfile}
                    disabled={
                      patientSummaryLoading ||
                      !patientSummary?.can_open_profile ||
                      !onOpenPatientProfile
                    }
                    className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <i className="fas fa-user mr-2"></i>
                    Patient profile
                  </button>
                  {user?.role === "clinician" && (
                    <button
                      type="button"
                      onClick={onMessagePatient}
                      disabled={
                        patientSummaryLoading ||
                        !patientSummary?.can_message ||
                        !onMessagePatient
                      }
                      className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <i className="fas fa-comments mr-2"></i>
                      Message patient
                    </button>
                  )}
                </div>
              </div>

              {patientSummaryLoading && (
                <div className="mt-5 flex items-center gap-3 rounded-lg bg-white p-4 text-sm text-slate-500">
                  <i className="fas fa-spinner fa-spin text-blue-600"></i>
                  Loading patient summary...
                </div>
              )}
              {patientSummaryError && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {patientSummaryError}
                </div>
              )}
              {patientSummary && !patientSummaryLoading && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Age", patientSummary.patient?.age ?? "—"],
                      [
                        "Blood type",
                        patientSummary.patient?.blood_type || "—",
                      ],
                      ["BMI", patientSummary.patient?.bmi ?? "—"],
                      [
                        "Blood pressure",
                        patientSummary.patient?.blood_pressure || "—",
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-blue-100 bg-white p-3"
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 font-bold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {patientSummary.can_open_profile && (
                      <>
                        <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700">
                          {patientSummary.record_count} records
                        </span>
                        <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700">
                          {patientSummary.active_prescription_count} active
                          prescriptions
                        </span>
                      </>
                    )}
                    <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700">
                      Status: {patientSummary.patient?.status || "Not set"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Latest clinical overview
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {patientSummary.clinical_overview}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                      Recent appointment history
                    </p>
                    {patientSummary.recent_appointments?.length ? (
                      <div className="mt-2 space-y-2">
                        {patientSummary.recent_appointments.map((history) => (
                          <div
                            key={history.id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-white p-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {history.reason || "Appointment"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {history.appointment_date} at{" "}
                                {history.appointment_time}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold capitalize text-slate-600">
                              {history.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No previous appointments found.
                      </p>
                    )}
                  </div>

                  {!patientSummary.can_message &&
                    user?.role === "clinician" && (
                      <p className="text-xs text-slate-500">
                        Messaging becomes available after the patient and
                        clinician establish a messaging connection.
                      </p>
                    )}
                  {!patientSummary.can_open_profile && (
                    <p className="text-xs text-slate-500">
                      The complete profile becomes available after appointment
                      approval or an accepted messaging connection.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Reason for visit
            </p>
            <p className="mt-3 whitespace-pre-wrap leading-6 text-slate-700">
              {appointment.reason || "No reason was provided."}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Clinical notes
              </p>
              {appointment.updated_at && (
                <span className="text-xs text-slate-400">
                  Updated {new Date(appointment.updated_at).toLocaleString()}
                </span>
              )}
            </div>
            {canEditNotes ? (
              <>
                <textarea
                  rows="5"
                  value={notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="Add appointment notes or preparation details"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={onSaveNotes}
                  disabled={busy}
                  className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  <i className="fas fa-floppy-disk mr-2"></i>
                  Save notes
                </button>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {appointment.notes || "No notes have been added."}
              </p>
            )}
          </section>

          {["patient", "clinician"].includes(user?.role) && (
            <VideoConsultationButton appointment={appointment} />
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white p-5">
          <div className="flex flex-wrap justify-end gap-2">
            {user?.role === "clinician" &&
              appointment.status === "pending" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onStatusChange("rejected")}
                    className="rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onStatusChange("approved")}
                    className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </>
              )}
            {user?.role === "clinician" &&
              appointment.status === "approved" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatusChange("completed")}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Mark complete
                </button>
              )}
            {user?.role === "patient" &&
              ["pending", "approved"].includes(appointment.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatusChange("cancelled")}
                  className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel appointment
                </button>
              )}
            {user?.role === "admin" && appointment.status === "pending" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatusChange("rejected")}
                  className="rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatusChange("approved")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Approve
                </button>
              </>
            )}
            {user?.role === "admin" &&
              appointment.status === "approved" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStatusChange("completed")}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Mark complete
                </button>
              )}
            {canDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={onDelete}
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
};

export default AppointmentDetailsDrawer;
