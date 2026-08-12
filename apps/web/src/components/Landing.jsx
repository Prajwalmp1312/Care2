import React from "react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    navigate("/register", { state: { preselectedRole: role } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-heartbeat text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                CareConnect Pro
              </h1>
              <p className="text-xs text-gray-600">
                Healthcare Communication Platform
              </p>
            </div>
          </div>

          {/* <button
            onClick={() => navigate("/admin")}
            className="px-4 py-2 text-purple-600 hover:text-purple-700 font-semibold transition"
          >
            <i className="fas fa-shield-alt mr-2"></i>
            Admin Portal
          </button> */}

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-2 text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/register")}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              Register
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-5xl font-bold text-gray-800 mb-6">
          Welcome to CareConnect Pro
        </h2>
        <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
          Seamless healthcare communication platform connecting patients,
          clinicians, and administrators. Choose your role to get started.
        </p>

        {/* Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16 max-w-5xl mx-auto">
          {/* Patient Card */}
          <div
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all hover:-translate-y-2 cursor-pointer group"
            onClick={() => handleRoleSelect("patient")}
          >
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-600 transition">
              <i className="fas fa-user text-4xl text-blue-600 group-hover:text-white transition"></i>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Patient</h3>
            <p className="text-gray-600 mb-6">
              Access your health records, communicate with your healthcare
              providers, and manage appointments.
            </p>
            <ul className="text-left space-y-2 text-sm text-gray-600 mb-6">
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                View medical records
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Message healthcare providers
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Track health metrics
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Schedule appointments
              </li>
            </ul>
            <button className="px-20 py-3 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition">
              Join as Patient
            </button>
          </div>

          {/* Clinician Card */}
          <div
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all hover:-translate-y-2 cursor-pointer group"
            onClick={() => handleRoleSelect("clinician")}
          >
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-indigo-600 transition">
              <i className="fas fa-user-md text-4xl text-indigo-600 group-hover:text-white transition"></i>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Clinician</h3>
            <p className="text-gray-600 mb-6">
              Manage patient care, access medical records, and collaborate with
              your healthcare team.
            </p>
            <ul className="text-left space-y-2 text-sm text-gray-600 mb-6">
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Manage patient records
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Clinical alerts & notifications
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Secure messaging
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Clinical notes management
              </li>
            </ul>
            <button
              onClick={() => navigate("/clinician-join")}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
            >
              Apply to Join as Clinician
            </button>
          </div>

          {/* Admin Card */}
          {/* <div 
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all hover:-translate-y-2 cursor-pointer group"
            onClick={() => handleRoleSelect('admin')}
          >
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-600 transition">
              <i className="fas fa-shield-alt text-4xl text-purple-600 group-hover:text-white transition"></i>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Administrator</h3>
            <p className="text-gray-600 mb-6">
              Oversee system operations, manage users, and monitor platform performance and analytics.
            </p>
            <ul className="text-left space-y-2 text-sm text-gray-600 mb-6">
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                User management
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                System analytics
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Access control
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>
                Platform monitoring
              </li>
            </ul>
            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition">
              Join as Admin
            </button>
          </div> */}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16 mt-16">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-gray-800 text-center mb-12">
            Why Choose CareConnect Pro?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-lock text-2xl text-blue-600"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">
                Secure & Private
              </h4>
              <p className="text-sm text-gray-600">
                End-to-end encryption for all communications
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-clock text-2xl text-green-600"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">
                24/7 Access
              </h4>
              <p className="text-sm text-gray-600">
                Access your health information anytime, anywhere
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-comments text-2xl text-purple-600"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">
                Real-time Communication
              </h4>
              <p className="text-sm text-gray-600">
                Secure messaging between all healthcare stakeholders
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-file-medical-alt text-2xl text-orange-600"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">
                Digital Records
              </h4>
              <p className="text-sm text-gray-600">
                All your medical records in one secure place
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">
            Ready to Transform Your Healthcare Experience?
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of patients and healthcare providers on CareConnect
            Pro
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => navigate("/register")}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition"
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg font-bold text-lg hover:bg-white/10 transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-heartbeat text-white"></i>
            </div>
            <span className="text-white font-bold">CareConnect Pro</span>
          </div>
          <p className="text-sm">
            © 2025 B360u Healthcare Platform. All rights reserved.
          </p>
          <p className="text-xs mt-2">
            HIPAA Compliant | Secure | Trusted by Healthcare Professionals
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
