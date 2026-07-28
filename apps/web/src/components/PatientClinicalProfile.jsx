import React, { useEffect, useState } from "react";
import axios from "axios";

const measurementFields = [
  ["weight_kg", "Weight (kg)"], ["height_cm", "Height (cm)"],
  ["body_fat_percentage", "Body fat (%)"], ["muscle_mass_kg", "Muscle mass (kg)"],
  ["waist_cm", "Waist (cm)"], ["systolic_bp", "Systolic BP"],
  ["diastolic_bp", "Diastolic BP"],
];

const PatientClinicalProfile = ({ patientEmail, patientId, canEdit = false, onClose, onUpdated }) => {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true); setError("");
      const res = await axios.get(`/api/patients/${encodeURIComponent(patientEmail)}/clinical-profile`);
      setData(res.data);
      setDraft({ ...res.data.patient, change_reason: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load patient profile");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [patientEmail]);

  const save = async () => {
    try {
      setSaving(true); setError("");
      await axios.put(`/api/admin/patients/${patientId || data.patient.id}`, draft);
      await load();
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update patient profile");
    } finally { setSaving(false); }
  };

  const medicines = (prescription) => prescription.medicines || [];
  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/55 p-4">
    <div className="mx-auto my-4 max-w-6xl rounded-2xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white">
        <div><h2 className="text-2xl font-bold">Patient Clinical Profile</h2><p className="text-sm text-blue-100">Summary, records, prescriptions, and longitudinal measurements</p></div>
        <button onClick={onClose} className="rounded-full bg-white/15 px-3 py-2 hover:bg-white/25" aria-label="Close">✕</button>
      </div>
      <div className="p-6">
        {loading && <p className="py-16 text-center text-gray-500">Loading clinical profile…</p>}
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
        {data && <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="rounded-xl border bg-gray-50 p-5">
              <h3 className="text-xl font-bold text-gray-900">{data.patient.name}</h3>
              <p className="text-sm text-gray-600">{data.patient.email}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <span>Age: <b>{data.patient.age ?? "—"}</b></span><span>Gender: <b>{data.patient.gender || "—"}</b></span>
                <span>Blood: <b>{data.patient.blood_type || "—"}</b></span><span>Status: <b>{data.patient.status || "—"}</b></span>
                <span>Alerts: <b>{data.patient.alerts ?? 0}</b></span><span>BMI: <b>{data.patient.bmi ?? "—"}</b></span>
              </div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="font-bold text-blue-900">Clinical Summary</h3>
              <p className="mt-2 text-sm text-blue-900">{data.summary.overview}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1">{data.summary.record_count} records</span><span className="rounded-full bg-white px-3 py-1">{data.summary.active_prescription_count} active prescriptions</span></div>
              {data.summary.key_findings?.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-blue-900">{data.summary.key_findings.map((item, index) => <li key={index}>{String(item)}</li>)}</ul>}
            </div>
          </section>

          <section className="rounded-xl border p-5">
            <h3 className="mb-4 text-lg font-bold">Current Body Composition & Vitals</h3>
            {canEdit && <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold">Name<input value={draft.name || ""} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm font-semibold">Age<input type="number" value={draft.age ?? ""} onChange={(e) => setDraft((current) => ({ ...current, age: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm font-semibold">Gender<input value={draft.gender || ""} onChange={(e) => setDraft((current) => ({ ...current, gender: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm font-semibold">Blood type<input value={draft.blood_type || ""} onChange={(e) => setDraft((current) => ({ ...current, blood_type: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm font-semibold">Phone<input value={draft.phone || ""} onChange={(e) => setDraft((current) => ({ ...current, phone: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm font-semibold">Emergency contact<input value={draft.emergency_contact || ""} onChange={(e) => setDraft((current) => ({ ...current, emergency_contact: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm font-semibold sm:col-span-2">Address<input value={draft.address || ""} onChange={(e) => setDraft((current) => ({ ...current, address: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            </div>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{measurementFields.map(([field, label]) => <label key={field} className="text-sm font-semibold text-gray-700">{label}<input type="number" step="0.1" disabled={!canEdit} value={draft[field] ?? ""} onChange={(e) => setDraft((current) => ({ ...current, [field]: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-gray-100" /></label>)}</div>
            {canEdit && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold">Status<select value={draft.status || "stable"} onChange={(e) => setDraft((current) => ({ ...current, status: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="stable">Stable</option><option value="attention">Attention</option><option value="critical">Critical</option></select></label>
              <label className="text-sm font-semibold">Alerts<input type="number" min="0" value={draft.alerts ?? 0} onChange={(e) => setDraft((current) => ({ ...current, alerts: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <label className="text-sm font-semibold sm:col-span-2">Reason for change<input value={draft.change_reason || ""} onChange={(e) => setDraft((current) => ({ ...current, change_reason: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Routine measurement update" /></label>
              <button onClick={save} disabled={saving} className="rounded-lg bg-purple-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save & Archive Previous Values"}</button>
            </div>}
          </section>

          <section className="rounded-xl border p-5"><h3 className="mb-3 text-lg font-bold">Measurement History</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left"><th className="p-2">Recorded</th><th className="p-2">Weight</th><th className="p-2">BMI</th><th className="p-2">Body fat</th><th className="p-2">Muscle</th><th className="p-2">Waist</th><th className="p-2">Blood pressure</th><th className="p-2">Reason</th></tr></thead><tbody>{data.profile_history.map((item) => <tr key={item.id} className="border-t"><td className="p-2">{new Date(item.recorded_at).toLocaleString()}</td><td className="p-2">{item.weight_kg ?? "—"}</td><td className="p-2">{item.bmi ?? "—"}</td><td className="p-2">{item.body_fat_percentage ?? "—"}</td><td className="p-2">{item.muscle_mass_kg ?? "—"}</td><td className="p-2">{item.waist_cm ?? "—"}</td><td className="p-2">{item.systolic_bp && item.diastolic_bp ? `${item.systolic_bp}/${item.diastolic_bp}` : "—"}</td><td className="p-2">{item.change_reason || "—"}</td></tr>)}</tbody></table>{!data.profile_history.length && <p className="py-6 text-center text-gray-500">No previous measurements yet.</p>}</div></section>

          <section className="rounded-xl border p-5"><h3 className="mb-3 text-lg font-bold">Medical Records</h3><div className="space-y-3">{data.records.map((record) => <div key={record.id} className="rounded-lg border bg-gray-50 p-4"><div className="flex justify-between gap-3"><b>{record.name}</b><span className="text-xs text-gray-500">{record.uploaded_at ? new Date(record.uploaded_at).toLocaleDateString() : ""}</span></div><p className="text-xs text-gray-500">{record.type} · {record.category}</p><p className="mt-2 text-sm text-gray-700">{record.analysis_summary || "No summary available"}</p></div>)}{!data.records.length && <p className="text-gray-500">No records available.</p>}</div></section>

          <section className="rounded-xl border p-5"><h3 className="mb-3 text-lg font-bold">Prescription History</h3><div className="space-y-3">{data.prescriptions.map((rx) => <div key={rx.id} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4"><div className="flex justify-between"><b>Prescription #{rx.id}</b><span className="rounded-full bg-white px-2 py-1 text-xs">{rx.status}</span></div><p className="mt-1 text-sm">Diagnosis: {rx.diagnosis || "Not specified"}</p><ul className="mt-2 list-disc pl-5 text-sm">{medicines(rx).map((med, index) => <li key={index}>{med.medicine_name} · {med.dosage} · {med.frequency} · {med.duration}</li>)}</ul></div>)}{!data.prescriptions.length && <p className="text-gray-500">No prescriptions available.</p>}</div></section>
        </div>}
      </div>
    </div>
  </div>;
};

export default PatientClinicalProfile;
