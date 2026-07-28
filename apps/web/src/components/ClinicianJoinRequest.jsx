import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';


import axios from 'axios';

const ClinicianJoinRequest = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    license_number: '',
    department: '',
    years_of_experience: '',
    message: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
  const { name, value } = e.target;

  setFormData({ ...formData, [name]: value });

  // clear error for this field while typing
  setErrors((prev) => ({
    ...prev,
    [name]: ""
  }));
};


  const validateForm = () => {
  const newErrors = {};

  if (!formData.name.trim()) {
    newErrors.name = "Full name is required";
  }

  if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    newErrors.email = "Enter a valid email address";
  }

  if (!formData.specialization.trim()) {
    newErrors.specialization = "Specialization is required";
  }

  if (!formData.license_number.trim()) {
    newErrors.license_number = "License number is required";
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');

  if (!validateForm()) return;

  setLoading(true);

  try {
    await axios.post(
      '/api/public/clinician-request',
      formData
    );
    navigate('/clinician-join/success', {
      state: {
        name: formData.name,
        email: formData.email,
        submittedAt: Date.now(),
      },
    });
  } catch (err) {
    setError(err.response?.data?.detail || 'An error occurred');
    setLoading(false);
  }
};


const isFormValid =
  formData.name &&
  formData.email &&
  formData.specialization &&
  formData.license_number &&
  Object.keys(errors).length === 0;


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-blue-700 font-semibold hover:text-blue-900 transition"
      >
        <i className="fas fa-arrow-left"></i> Back to Home
      </button>

      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <i className="fas fa-user-md text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Join as a Clinician</h1>
          <p className="text-gray-600 mt-2">Submit your application to join CareConnect Pro</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Dr. John Smith"
              />
              {errors.name && (
  <p className="text-red-500 text-xs mt-1">
    {errors.name}
  </p>
)}

            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="doctor@example.com"
              />
              {errors.email && (
  <p className="text-red-500 text-xs mt-1">
    {errors.email}
  </p>
)}

            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Specialization *
              </label>
              <input
                type="text"
                name="specialization"
                value={formData.specialization}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Cardiology"
              />
              {errors.specialization && (
  <p className="text-red-500 text-xs mt-1">
    {errors.specialization}
  </p>
)}

            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                License Number *
              </label>
              <input
                type="text"
                name="license_number"
                value={formData.license_number}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="MD123456"
              />
              {errors.license_number && (
  <p className="text-red-500 text-xs mt-1">
    {errors.license_number}
  </p>
)}

            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Emergency"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Years of Experience
              </label>
              <input
                type="number"
                name="years_of_experience"
                value={formData.years_of_experience}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="5"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Why do you want to join CareConnect Pro?
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Tell us about yourself and why you'd like to join our network..."
              />
            </div>
          </div>

<button
  type="submit"
  disabled={!isFormValid || loading}
  className={`w-full py-3 px-4 rounded-lg font-semibold transition
    ${
      isFormValid
        ? "bg-blue-600 hover:bg-blue-700 text-white"
        : "bg-gray-400 cursor-not-allowed text-white"
    }
  `}
>
  {loading ? 'Submitting...' : 'Submit Application'}
</button>

        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Login here
          </button>
        </p>
      </div>
    </div>
  );
};

export default ClinicianJoinRequest;