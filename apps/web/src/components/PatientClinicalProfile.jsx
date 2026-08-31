import React, { useEffect, useState } from "react";
import axios from "axios";
import AIReportComparison from "./AIReportComparison";
import ClinicalExportButton from "./ClinicalExportButton";

const measurementFields = [
  ["weight_kg", "Weight (kg)"],
  ["height_cm", "Height (cm)"],
  ["body_fat_percentage", "Body fat (%)"],
  ["muscle_mass_kg", "Muscle mass (kg)"],
  ["waist_cm", "Waist (cm)"],
  ["systolic_bp", "Systolic BP"],
  ["diastolic_bp", "Diastolic BP"],
];

const PatientClinicalProfile = ({
  patientEmail,
  patientId,
  canEdit = false,
  canExport = true,
  onClose,
  onUpdated,
}) => {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(
        `/api/patients/${encodeURIComponent(patientEmail)}/clinical-profile`,
      );
      setData(res.data);
      setDraft({ ...res.data.patient, change_reason: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load patient profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [patientEmail]);

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      await axios.put(
        `/api/admin/patients/${patientId || data.patient.id}`,
        draft,
      );
      await load();
      onUpdated?.();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to update patient profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const medicines = (prescription) => prescription.medicines || [];
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/55 p-4">
      <div className="mx-auto my-4 max-w-6xl rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white">
          <div>
            <h2 className="text-2xl font-bold">Patient Clinical Profile</h2>
            <p className="text-sm text-blue-100">
              Summary, records, prescriptions, and longitudinal measurements
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <ClinicalExportButton patientEmail={patientEmail} dark />
            )}
            <button
              onClick={onClose}
              className="rounded-full bg-white/15 px-3 py-2 hover:bg-white/25"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-6">
          {loading && (
            <p className="py-16 text-center text-gray-500">
              Loading clinical profile…
            </p>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
              {error}
            </div>
          )}
          {data && (
            <div className="space-y-6">
              <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                <div className="rounded-xl border bg-gray-50 p-5">
                  <h3 className="text-xl font-bold text-gray-900">
                    {data.patient.name}
                  </h3>
                  <p className="text-sm text-gray-600">{data.patient.email}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <span>
                      Age: <b>{data.patient.age ?? "—"}</b>
                    </span>
                    <span>
                      Gender: <b>{data.patient.gender || "—"}</b>
                    </span>
                    <span>
                      Blood: <b>{data.patient.blood_type || "—"}</b>
                    </span>
                    <span>
                      Status: <b>{data.patient.status || "—"}</b>
                    </span>
                    <span>
                      Alerts: <b>{data.patient.alerts ?? 0}</b>
                    </span>
                    <span>
                      BMI: <b>{data.patient.bmi ?? "—"}</b>
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                  <h3 className="font-bold text-blue-900">Clinical Summary</h3>
                  <p className="mt-2 text-sm text-blue-900">
                    {data.summary.overview}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1">
                      {data.summary.record_count} records
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      {data.summary.active_prescription_count} active
                      prescriptions
                    </span>
                  </div>
                  {data.summary.key_findings?.length > 0 && (
                    <ul className="mt-3 list-disc pl-5 text-sm text-blue-900">
                      {data.summary.key_findings.map((item, index) => (
                        <li key={index}>{String(item)}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 border-t border-blue-200 pt-3 text-sm text-blue-950">
                    <p className="font-bold">
                      Patient-declared meal restrictions
                    </p>
                    <p className="mt-1">
                      <b>Allergies:</b>{" "}
                      {data.meal_preferences?.allergies?.join(", ") ||
                        "None declared"}
                    </p>
                    <p>
                      <b>Intolerances:</b>{" "}
                      {data.meal_preferences?.intolerances?.join(", ") ||
                        "None declared"}
                    </p>
                    <p>
                      <b>Dietary preferences:</b>{" "}
                      {data.meal_preferences?.dietary_preferences?.join(", ") ||
                        "None declared"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border p-5">
                <h3 className="mb-4 text-lg font-bold">
                  Current Body Composition & Vitals
                </h3>
                {canEdit && (
                  <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-semibold">
                      Name
                      <input
                        value={draft.name || ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            name: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Age
                      <input
                        type="number"
                        value={draft.age ?? ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            age: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Gender
                      <input
                        value={draft.gender || ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            gender: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Blood type
                      <input
                        value={draft.blood_type || ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            blood_type: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Phone
                      <input
                        value={draft.phone || ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            phone: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Emergency contact
                      <input
                        value={draft.emergency_contact || ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            emergency_contact: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-semibold sm:col-span-2">
                      Address
                      <input
                        value={draft.address || ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            address: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {measurementFields.map(([field, label]) => (
                    <label
                      key={field}
                      className="text-sm font-semibold text-gray-700"
                    >
                      {label}
                      <input
                        type="number"
                        step="0.1"
                        disabled={!canEdit}
                        value={draft[field] ?? ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            [field]: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
                      />
                    </label>
                  ))}
                </div>
                {canEdit && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-semibold">
                      Status
                      <select
                        value={draft.status || "stable"}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            status: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      >
                        <option value="stable">Stable</option>
                        <option value="attention">Attention</option>
                        <option value="critical">Critical</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      Alerts
                      <input
                        type="number"
                        min="0"
                        value={draft.alerts ?? 0}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            alerts: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-sm font-semibold sm:col-span-2">
                      Reason for change
                      <input
                        value={draft.change_reason || ""}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            change_reason: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        placeholder="Routine measurement update"
                      />
                    </label>
                    <button
                      onClick={save}
                      disabled={saving}
                      className="rounded-lg bg-purple-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save & Archive Previous Values"}
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-xl border p-5">
                <h3 className="mb-3 text-lg font-bold">Measurement History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-2">Recorded</th>
                        <th className="p-2">Weight</th>
                        <th className="p-2">BMI</th>
                        <th className="p-2">Body fat</th>
                        <th className="p-2">Muscle</th>
                        <th className="p-2">Waist</th>
                        <th className="p-2">Blood pressure</th>
                        <th className="p-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.profile_history.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2">
                            {new Date(item.recorded_at).toLocaleString()}
                          </td>
                          <td className="p-2">{item.weight_kg ?? "—"}</td>
                          <td className="p-2">{item.bmi ?? "—"}</td>
                          <td className="p-2">
                            {item.body_fat_percentage ?? "—"}
                          </td>
                          <td className="p-2">{item.muscle_mass_kg ?? "—"}</td>
                          <td className="p-2">{item.waist_cm ?? "—"}</td>
                          <td className="p-2">
                            {item.systolic_bp && item.diastolic_bp
                              ? `${item.systolic_bp}/${item.diastolic_bp}`
                              : "—"}
                          </td>
                          <td className="p-2">{item.change_reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.profile_history.length && (
                    <p className="py-6 text-center text-gray-500">
                      No previous measurements yet.
                    </p>
                  )}
                </div>
              </section>

              <AIReportComparison records={data.records} />

              <section className="rounded-xl border p-5">
                <h3 className="mb-3 text-lg font-bold">Medical Records</h3>
                <div className="space-y-3">
                  {data.records.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-lg border bg-gray-50 p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <b>{record.name}</b>
                        <span className="text-xs text-gray-500">
                          {record.uploaded_at
                            ? new Date(record.uploaded_at).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {record.type} · {record.category}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        {record.analysis_summary || "No summary available"}
                      </p>
                    </div>
                  ))}
                  {!data.records.length && (
                    <p className="text-gray-500">No records available.</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-purple-100 bg-purple-50 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-purple-950">
                      Cross Consultation History
                    </h3>
                    <p className="text-sm text-purple-700">
                      Specialist referrals, attached records, status, and
                      specialist notes.
                    </p>
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-purple-700">
                    {data.cross_consultations?.length || 0} consults
                  </span>
                </div>

                {data.cross_consultations?.length > 0 ? (
                  <div className="space-y-3">
                    {data.cross_consultations.map((consult) => (
                      <div
                        key={consult.id}
                        className="rounded-xl border border-purple-100 bg-white p-4"
                      >
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div>
                            <p className="font-bold text-gray-900">
                              {consult.reason}
                            </p>

                            <p className="mt-1 text-sm text-gray-600">
                              From Dr. {consult.requested_by_clinician_name} to
                              Dr. {consult.requested_to_clinician_name}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {consult.created_at
                                ? new Date(consult.created_at).toLocaleString()
                                : ""}
                            </p>
                          </div>

                          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold capitalize text-purple-700">
                            {consult.status}
                          </span>
                        </div>

                        {consult.case_summary && (
                          <p className="mt-3 text-sm text-gray-700">
                            <strong>Case Summary:</strong>{" "}
                            {consult.case_summary}
                          </p>
                        )}

                        {consult.attached_records?.length > 0 && (
                          <div className="mt-3 rounded-lg bg-gray-50 p-3">
                            <p className="mb-2 text-sm font-bold text-gray-800">
                              Attached Records
                            </p>

                            <div className="space-y-2">
                              {consult.attached_records.map((record) => (
                                <div
                                  key={record.id}
                                  className="rounded-lg border border-gray-200 bg-white p-3"
                                >
                                  <p className="text-sm font-semibold text-gray-900">
                                    {record.name}
                                  </p>

                                  <p className="text-xs text-gray-500">
                                    {record.type} · {record.category}
                                  </p>

                                  {record.analysis_summary && (
                                    <p className="mt-1 text-xs text-gray-600">
                                      {record.analysis_summary}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="bg-white border rounded-xl p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h5 className="text-lg font-semibold text-slate-900 break-words">
                                {record.file_name}
                              </h5>
                              <p className="text-sm text-slate-500 mb-2">
                                {record.record_type} •{" "}
                                {record.category || "Other"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadAttachedRecord(
                                  record.id,
                                  record.file_name,
                                )
                              }
                              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                              Download PDF
                            </button>
                          </div>

                          <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap break-words">
                            {record.extracted_text}
                          </p>
                        </div> 

                        {consult.specialist_notes && (
                          <p className="mt-3 text-sm text-gray-700">
                            <strong>Specialist Notes:</strong>{" "}
                            {consult.specialist_notes}
                          </p>
                        )}

                        {consult.recommendation && (
                          <p className="mt-2 text-sm text-gray-700">
                            <strong>Recommendation:</strong>{" "}
                            {consult.recommendation}
                          </p>
                        )}

                        {consult.completed_at && (
                          <p className="mt-2 text-xs text-green-700">
                            Completed on{" "}
                            {new Date(consult.completed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-white p-4 text-sm text-gray-500">
                    No cross consultations have been created for this patient
                    yet.
                  </p>
                )}
              </section>

              <section className="rounded-xl border p-5">
                <h3 className="mb-3 text-lg font-bold">Prescription History</h3>
                <div className="space-y-3">
                  {data.prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="rounded-lg border border-emerald-100 bg-emerald-50 p-4"
                    >
                      <div className="flex justify-between">
                        <b>Prescription #{rx.id}</b>
                        <span className="rounded-full bg-white px-2 py-1 text-xs">
                          {rx.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        Diagnosis: {rx.diagnosis || "Not specified"}
                      </p>
                      <ul className="mt-2 list-disc pl-5 text-sm">
                        {medicines(rx).map((med, index) => (
                          <li key={index}>
                            {med.medicine_name} · {med.dosage} · {med.frequency}{" "}
                            · {med.duration}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {!data.prescriptions.length && (
                    <p className="text-gray-500">No prescriptions available.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientClinicalProfile;
