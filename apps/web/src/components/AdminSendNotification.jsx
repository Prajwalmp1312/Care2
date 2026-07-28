import React, { useState } from "react";
import axios from "axios";

const AdminSendNotification = () => {
  const [formData, setFormData] = useState({
    user_email: "",
    title: "",
    message: "",
    type: "admin",
  });

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setSuccess("");
    setError("");
  };

  const sendNotification = async (e) => {
    e.preventDefault();

    try {
      await axios.post("/api/admin/notifications", formData);
      setSuccess("Notification sent successfully");
      setFormData({
        user_email: "",
        title: "",
        message: "",
        type: "admin",
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send notification");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        Send Notification
      </h3>

      {success && (
        <div className="bg-green-100 text-green-700 p-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={sendNotification} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            User Email
          </label>
          <input
            type="email"
            name="user_email"
            value={formData.user_email}
            onChange={handleChange}
            placeholder="patient@example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Notification title"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Message
          </label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows="4"
            placeholder="Notification message"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Type
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          >
            <option value="admin">Admin</option>
            <option value="info">Info</option>
            <option value="alert">Alert</option>
            <option value="appointment">Appointment</option>
            <option value="prescription">Prescription</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Send Notification
        </button>
      </form>
    </div>
  );
};

export default AdminSendNotification;
