import React, { useEffect, useState } from "react";
import axios from "axios";
import VoicePrescription from "./VoicePrescription";

const emptyMedicine = {
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

const Prescriptions = ({ user, initialPatientEmail = "" }) => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    patient_email: "",
    diagnosis: "",
    instructions: "",
    medicines: [{ ...emptyMedicine }],
  });

  const getStatusClasses = (status) => {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "completed") return "bg-blue-100 text-blue-700";
    if (status === "cancelled") return "bg-gray-100 text-gray-700";
    return "bg-gray-100 text-gray-700";
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
  });

  const getMedicines = (prescription) => {
    if (Array.isArray(prescription.medicines) && prescription.medicines.length > 0) {
      return prescription.medicines;
    }

    if (prescription.medicine_name) {
      return [
        {
          medicine_name: prescription.medicine_name,
          dosage: prescription.dosage,
          frequency: prescription.frequency,
          duration: prescription.duration,
          instructions: "",
        },
      ];
    }

    return [];
  };

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get("/api/prescriptions", {
        headers: getAuthHeaders(),
      });

      setPrescriptions(res.data.prescriptions || []);
    } catch (err) {
      if (err.response?.status === 404) {
        setPrescriptions([]);
        setError("");
        return;
      }

      setError(err.response?.data?.detail || "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  };

  const loadConnectedPatients = async () => {
    if (user?.role !== "clinician") return;

    try {
      const res = await axios.get("/api/conversations", {
        headers: getAuthHeaders(),
      });
      const conversations = res.data.conversations || [];

      const patientList = conversations
        .filter((c) => c.other_user_role === "patient")
        .map((c) => ({
          email: c.other_user_email,
          name: c.other_user_name,
        }));

      setPatients(patientList);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load patients");
    }
  };

  useEffect(() => {
    loadPrescriptions();
    loadConnectedPatients();
  }, [user?.role]);

  useEffect(() => {
    if (initialPatientEmail && user?.role === "clinician") {
      setFormData((current) => ({ ...current, patient_email: initialPatientEmail }));
    }
  }, [initialPatientEmail, user?.role]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    setMessage("");
    setError("");
  };

  const handleMedicineChange = (index, field, value) => {
    setFormData((prev) => {
      const nextMedicines = [...prev.medicines];
      nextMedicines[index] = {
        ...nextMedicines[index],
        [field]: value,
      };

      return {
        ...prev,
        medicines: nextMedicines,
      };
    });

    setMessage("");
    setError("");
  };

  const addMedicine = () => {
    setFormData((prev) => ({
      ...prev,
      medicines: [...prev.medicines, { ...emptyMedicine }],
    }));
  };

  const removeMedicine = (index) => {
    setFormData((prev) => {
      if (prev.medicines.length === 1) return prev;

      return {
        ...prev,
        medicines: prev.medicines.filter((_, idx) => idx !== index),
      };
    });
  };

  const resetForm = () => {
    setFormData({
      patient_email: initialPatientEmail || "",
      diagnosis: "",
      instructions: "",
      medicines: [{ ...emptyMedicine }],
    });
  };

  const handleVoiceTranscript = async (transcript) => {
    setError("");
    try {
      setLoading(true);
      const res = await axios.post(
        "/api/prescriptions/parse-dictation",
        { transcript },
        { headers: getAuthHeaders() },
      );
      const draft = res.data;
      setFormData((current) => ({
        ...current,
        diagnosis: draft.diagnosis || current.diagnosis,
        instructions: draft.instructions || current.instructions,
        medicines: draft.medicines?.length ? draft.medicines : current.medicines,
      }));
      setMessage("Voice dictation added as a draft. Review every field before creating the prescription.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to process prescription dictation");
    } finally {
      setLoading(false);
    }
  };

  const validateMedicines = () => {
    const validMedicines = formData.medicines.filter((medicine) =>
      medicine.medicine_name.trim()
    );

    if (validMedicines.length === 0) {
      return "Please add at least one medicine";
    }

    for (let i = 0; i < validMedicines.length; i += 1) {
      const medicine = validMedicines[i];
      const medicineLabel = medicine.medicine_name || `Medicine ${i + 1}`;

      if (!medicine.dosage.trim()) return `${medicineLabel}: dosage is required`;
      if (!medicine.frequency.trim()) return `${medicineLabel}: frequency is required`;
      if (!medicine.duration.trim()) return `${medicineLabel}: duration is required`;
    }

    return "";
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!formData.patient_email) {
      setError("Please select a patient");
      return;
    }

    const medicineError = validateMedicines();
    if (medicineError) {
      setError(medicineError);
      return;
    }

    const medicines = formData.medicines
      .filter((medicine) => medicine.medicine_name.trim())
      .map((medicine) => ({
        medicine_name: medicine.medicine_name.trim(),
        dosage: medicine.dosage.trim(),
        frequency: medicine.frequency.trim(),
        duration: medicine.duration.trim(),
        instructions: medicine.instructions.trim(),
      }));

    try {
      setLoading(true);

      await axios.post(
        "/api/prescriptions",
        {
          patient_email: formData.patient_email,
          diagnosis: formData.diagnosis,
          instructions: formData.instructions,
          medicines,
        },
        { headers: getAuthHeaders() }
      );

      setMessage(`Prescription created successfully with ${medicines.length} medicine${medicines.length !== 1 ? "s" : ""}`);
      resetForm();
      await loadPrescriptions();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create prescription");
    } finally {
      setLoading(false);
    }
  };

  const updatePrescriptionStatus = async (prescriptionId, status) => {
    setMessage("");
    setError("");

    try {
      setLoading(true);

      await axios.put(
        `/api/prescriptions/${prescriptionId}/status`,
        { status },
        { headers: getAuthHeaders() }
      );

      setMessage(`Prescription marked as ${status}`);
      await loadPrescriptions();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update prescription");
    } finally {
      setLoading(false);
    }
  };

  const deletePrescription = async (prescriptionId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this prescription?"
    );

    if (!confirmDelete) return;

    setMessage("");
    setError("");

    try {
      setLoading(true);
      await axios.delete(`/api/prescriptions/${prescriptionId}`, {
        headers: getAuthHeaders(),
      });
      setMessage("Prescription deleted successfully");
      await loadPrescriptions();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete prescription");
    } finally {
      setLoading(false);
    }
  };

  const printPrescription = (prescription) => {
    const printWindow = window.open("", "_blank");
    const medicines = getMedicines(prescription);
    const medicineRows = medicines
      .map(
        (medicine, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${medicine.medicine_name || "N/A"}</td>
            <td>${medicine.dosage || "N/A"}</td>
            <td>${medicine.frequency || "N/A"}</td>
            <td>${medicine.duration || "N/A"}</td>
            <td>${medicine.instructions || "-"}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Prescription</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #111827;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              color: #2563eb;
              font-size: 28px;
              font-weight: bold;
            }
            .section {
              margin-bottom: 25px;
            }
            .section h3 {
              color: #1f2937;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 6px;
            }
            .row {
              margin: 8px 0;
            }
            .label {
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 12px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f3f4f6;
            }
            .footer {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>

        <body>
          <div class="header">
            <div class="title">CareConnect Pro</div>
            <p>Medical Prescription</p>
          </div>

          <div class="section">
            <h3>Patient Details</h3>
            <div class="row"><span class="label">Name:</span> ${prescription.patient_name}</div>
            <div class="row"><span class="label">Email:</span> ${prescription.patient_email}</div>
            <div class="row"><span class="label">Age:</span> ${prescription.patient_age || "N/A"}</div>
            <div class="row"><span class="label">Gender:</span> ${prescription.patient_gender || "N/A"}</div>
            <div class="row"><span class="label">Blood Type:</span> ${prescription.patient_blood_type || "N/A"}</div>
          </div>

          <div class="section">
            <h3>Doctor Details</h3>
            <div class="row"><span class="label">Doctor:</span> Dr. ${prescription.clinician_name}</div>
            <div class="row"><span class="label">Specialization:</span> ${prescription.clinician_specialization || "N/A"}</div>
            <div class="row"><span class="label">Department:</span> ${prescription.clinician_department || "N/A"}</div>
          </div>

          <div class="section">
            <h3>Diagnosis</h3>
            <p>${prescription.diagnosis || "N/A"}</p>
          </div>

          <div class="section">
            <h3>Medicines</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Medicine Instructions</th>
                </tr>
              </thead>
              <tbody>
                ${medicineRows || `<tr><td colspan="6">No medicine details available</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h3>General Instructions</h3>
            <p>${prescription.instructions || "No additional instructions"}</p>
          </div>

          <div class="section">
            <div class="row"><span class="label">Status:</span> ${prescription.status}</div>
            <div class="row"><span class="label">Created At:</span> ${
              prescription.created_at
                ? new Date(prescription.created_at).toLocaleString()
                : "N/A"
            }</div>
          </div>

          <div class="footer">
            <div>
              <p>__________________________</p>
              <p>Patient Signature</p>
            </div>
            <div>
              <p>__________________________</p>
              <p>Doctor Signature</p>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold mb-2">
          <i className="fas fa-prescription-bottle-medical mr-2"></i>
          Prescription Management
        </h2>
        <p className="opacity-90">
          {user?.role === "clinician"
            ? "Create and manage prescriptions with multiple medicines"
            : user?.role === "patient"
              ? "View prescriptions provided by your clinicians"
              : "View and manage all prescriptions"}
        </p>
      </div>

      {message && (
        <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {user?.role === "clinician" && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              Create New Prescription
            </h3>
            <span className="text-sm text-gray-500">
              {formData.medicines.length} medicine{formData.medicines.length !== 1 ? "s" : ""}
            </span>
          </div>

          <form onSubmit={handleCreatePrescription} className="space-y-5">
            <VoicePrescription onTranscript={handleVoiceTranscript} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Patient
              </label>
              <select
                name="patient_email"
                value={formData.patient_email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Choose a patient</option>
                {patients.map((patient) => (
                  <option key={patient.email} value={patient.email}>
                    {patient.name} - {patient.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Diagnosis
              </label>
              <textarea
                name="diagnosis"
                value={formData.diagnosis}
                onChange={handleChange}
                rows="3"
                placeholder="Enter diagnosis"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-800">Medicines</h4>
                <button
                  type="button"
                  onClick={addMedicine}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-lg font-semibold transition"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Add Medicine
                </button>
              </div>

              {formData.medicines.map((medicine, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-bold text-gray-800">Medicine {index + 1}</h5>
                    {formData.medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-semibold"
                      >
                        <i className="fas fa-trash mr-1"></i>
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Medicine Name
                      </label>
                      <input
                        type="text"
                        value={medicine.medicine_name}
                        onChange={(e) =>
                          handleMedicineChange(index, "medicine_name", e.target.value)
                        }
                        placeholder="Paracetamol"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Dosage
                      </label>
                      <input
                        type="text"
                        value={medicine.dosage}
                        onChange={(e) =>
                          handleMedicineChange(index, "dosage", e.target.value)
                        }
                        placeholder="500mg"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Frequency
                      </label>
                      <input
                        type="text"
                        value={medicine.frequency}
                        onChange={(e) =>
                          handleMedicineChange(index, "frequency", e.target.value)
                        }
                        placeholder="Twice a day"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={medicine.duration}
                        onChange={(e) =>
                          handleMedicineChange(index, "duration", e.target.value)
                        }
                        placeholder="5 days"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Medicine-specific Instructions
                      </label>
                      <input
                        type="text"
                        value={medicine.instructions}
                        onChange={(e) =>
                          handleMedicineChange(index, "instructions", e.target.value)
                        }
                        placeholder="Take after food"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                General Instructions
              </label>
              <textarea
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                rows="4"
                placeholder="Overall instructions for the patient"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
            >
              <i className="fas fa-plus mr-2"></i>
              {loading ? "Creating..." : "Create Prescription"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">
            {user?.role === "patient"
              ? "My Prescriptions"
              : user?.role === "clinician"
                ? "Created Prescriptions"
                : "All Prescriptions"}
          </h3>

          <button
            onClick={loadPrescriptions}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium"
          >
            <i className="fas fa-sync-alt mr-2"></i>
            Refresh
          </button>
        </div>

        {loading && prescriptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Loading prescriptions...
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-prescription-bottle-medical text-4xl mb-3 text-gray-300"></i>
            <p>No prescriptions available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-sm text-gray-600">
                  <th className="px-6 py-3">
                    {user?.role === "patient" ? "Clinician" : "Patient"}
                  </th>
                  <th className="px-6 py-3">Medicines</th>
                  <th className="px-6 py-3">Diagnosis</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {prescriptions.map((prescription) => {
                  const medicines = getMedicines(prescription);

                  return (
                    <tr key={prescription.id} className="border-t border-gray-100">
                      <td className="px-6 py-4 align-top">
                        {user?.role === "patient" ? (
                          <div>
                            <div className="font-semibold text-gray-800">
                              Dr. {prescription.clinician_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {prescription.clinician_specialization || "General"}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-gray-800">
                              {prescription.patient_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {prescription.patient_email}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top min-w-[320px]">
                        <div className="space-y-3">
                          {medicines.length === 0 ? (
                            <span className="text-gray-500 text-sm">No medicine details</span>
                          ) : (
                            medicines.map((medicine, index) => (
                              <div
                                key={`${prescription.id}-${index}`}
                                className="p-3 bg-purple-50 border border-purple-100 rounded-lg"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-semibold text-gray-800">
                                    {index + 1}. {medicine.medicine_name}
                                  </div>
                                  <span className="text-xs bg-white text-purple-700 border border-purple-200 px-2 py-1 rounded-full">
                                    {medicine.duration}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                                  <div>
                                    <span className="font-semibold">Dosage:</span> {medicine.dosage}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Frequency:</span> {medicine.frequency}
                                  </div>
                                  {medicine.instructions && (
                                    <div className="md:col-span-2">
                                      <span className="font-semibold">Instructions:</span> {medicine.instructions}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top max-w-xs">
                        <div className="text-gray-800">
                          {prescription.diagnosis || "N/A"}
                        </div>
                        {prescription.instructions && (
                          <div className="text-sm text-gray-500 mt-2">
                            <span className="font-semibold">Instructions:</span> {prescription.instructions}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
                            prescription.status
                          )}`}
                        >
                          {prescription.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top text-sm text-gray-500">
                        {prescription.created_at
                          ? new Date(prescription.created_at).toLocaleDateString()
                          : "N/A"}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => printPrescription(prescription)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                          >
                            Print
                          </button>

                          {(user?.role === "clinician" || user?.role === "admin") &&
                            prescription.status === "active" && (
                              <button
                                onClick={() =>
                                  updatePrescriptionStatus(
                                    prescription.id,
                                    "completed"
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm"
                              >
                                Complete
                              </button>
                            )}

                          {(user?.role === "clinician" || user?.role === "admin") &&
                            prescription.status === "active" && (
                              <button
                                onClick={() =>
                                  updatePrescriptionStatus(
                                    prescription.id,
                                    "cancelled"
                                  )
                                }
                                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
                              >
                                Cancel
                              </button>
                            )}

                          {(user?.role === "clinician" || user?.role === "admin") && (
                            <button
                              onClick={() => deletePrescription(prescription.id)}
                              className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Prescriptions;
