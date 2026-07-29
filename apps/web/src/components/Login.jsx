import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";

const PUBLIC_ROLES = ['patient', 'clinician'];

const Login = ({ adminOnly = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login, register, logout, completeExternalLogin } = useAuth();
  const isRegisterRoute = location.pathname === '/register';
  const preselectedRole = adminOnly
    ? 'admin'
    : PUBLIC_ROLES.includes(location.state?.preselectedRole)
      ? location.state.preselectedRole
      : undefined;
  const navigateToHome = (role) => {
    navigate(role === 'admin' ? '/admin/dashboard' : '/dashboard', { replace: true });
  };
  
  const [isLoginMode, setIsLoginMode] = useState(adminOnly ? true : !isRegisterRoute && !preselectedRole);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: preselectedRole || 'patient',
    gender:'male',
    specialization:'',
    department:'',
    years_of_experience:''
  });

  const [registerStep, setRegisterStep]=useState(1)

  useEffect(() => {
    if (user) {
      if (adminOnly && user.role !== 'admin') {
        return;
      }

      // For security UX: visiting /admin should always prompt login form,
      // even if an admin session exists in localStorage.
      if (adminOnly && location.pathname === '/admin') {
        return;
      }

      navigateToHome(user.role);
      return;
    }

    if (adminOnly) {
      setIsLoginMode(true);
      setFormData(prev => ({ ...prev, role: 'admin' }));
      return;
    }

    if (preselectedRole) {
      setIsLoginMode(false);
      setFormData(prev => ({ ...prev, role: preselectedRole }));
      return;
    }

    setIsLoginMode(!isRegisterRoute);
  }, [adminOnly, isRegisterRoute, location.pathname, preselectedRole, user, navigate]);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // const [isVerificationStep, setIsVerificationStep] = useState(false);
  // const [verificationCode, setVerificationCode] = useState('');
  // const [verificationEmail, setVerificationEmail] = useState('');
  const emailLabel = adminOnly ? 'Developer Username or Email' : 'Email';
  const emailPlaceholder = adminOnly ? 'Enter developer username or admin email' : 'Enter your email';

  const getErrorMessage = (err, fallback = 'An error occurred') => {
    const detail = err?.response?.data?.detail;
    const message = err?.response?.data?.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => item?.msg || item?.message || fallback)
        .join(', ');
    }

    if (detail && typeof detail === 'object') {
      return detail.message || fallback;
    }

    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message;
    }

    return fallback;
  };

 const handleChange = (e) => {
  const { name, value } = e.target;

  setFormData(prev => ({ ...prev, [name]: value }));

  // Clear global error while typing
  if (error) setError('');
  if (info) setInfo('');
};

  const validatePassword = () => {
  if (formData.password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(formData.password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(formData.password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(formData.password)) {
    return "Password must contain at least one number";
  }
  if (!/[!@#$%^&*]/.test(formData.password)) {
    return "Password must contain at least one special character";
  }
  if (formData.password !== formData.confirmPassword) {
    return "Passwords do not match";
  }
  return null;
};
const isPasswordValid = () => {
  return (
    formData.password.length >= 8 &&
    /[A-Z]/.test(formData.password) &&
    /[a-z]/.test(formData.password) &&
    /[0-9]/.test(formData.password) &&
    /[!@#$%^&*]/.test(formData.password) &&
    formData.password === formData.confirmPassword
  );
};
  // ✅ STEP 2: form completeness checks

const isLoginFormValid =
  formData.email.trim() !== "" &&
  formData.password.trim() !== "";

const isRegisterFormValid =
  formData.name.trim() !== "" &&
  formData.email.trim() !== "" &&
  isPasswordValid();

const isClinicianProfessionalStepValid=
  formData.specialization.trim() !== "" &&
  formData.department.trim() !== "" &&
  formData.years_of_experience !== "" &&
  Number(formData.years_of_experience)>=0;


  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setInfo('');

  try {
    if (isLoginMode) {
      setLoading(true);
      // 🔐 LOGIN → no password rules here
      const loggedInUser = await login(formData.email, formData.password);

      if (adminOnly && loggedInUser.role !== 'admin') {
        logout();
        setError('Admin access only.');
        setLoading(false);
        return;
      }

      if (!adminOnly && !PUBLIC_ROLES.includes(loggedInUser.role)) {
        logout();
        setError('Use the admin portal to sign in.');
        setLoading(false);
        return;
      }

      navigateToHome(loggedInUser.role);
      setLoading(false)
      return;
    }
      // 📝 REGISTER → password validation here
    const passwordError = validatePassword();
    if (passwordError) {
      setError(passwordError);
      return;
    } 

     if (formData.role === "clinician" && registerStep === 1) {
      setRegisterStep(2);
      return;
    }

    if (formData.role === "clinician" && !isClinicianProfessionalStepValid) {
      setError("Please fill specialization, department, and years of experience");
      return;
    }

    setLoading(true);

      const response = await register(
        formData.name,
        formData.email,
        formData.password,
        formData.role,
        formData.gender,
        formData.specialization,
        formData.department,
        formData.years_of_experience
      );

      const loggedInUser = await login(formData.email, formData.password);
      navigateToHome(loggedInUser.role);
      setLoading(false);
      // setVerificationEmail(formData.email);
      // setIsVerificationStep(true);
      // setInfo(response?.message || 'Verification code sent to your email.');
      // setInfo("Registration successful. Please login.");
      //   setIsLoginMode(true);
      setFormData((prev) => ({
      ...prev,
      password: "",
      confirmPassword: "",
    }))
  } catch (err) {
    setError(getErrorMessage(err, 'An error occurred'));
    console.log("LOGIN ERROR:", err.response?.data);
    setLoading(false);
  }
};

  // const handleVerifyEmail = async (e) => {
  //   e.preventDefault();
  //   setError('');
  //   setInfo('');
  //   setLoading(true);

  //   try {
  //     const response = await verifyEmail(verificationEmail, verificationCode);
  //     setInfo(response?.message || 'Email verified successfully. Please login.');
  //     setIsVerificationStep(false);
  //     setIsLoginMode(true);
  //     setVerificationCode('');
  //   } catch (err) {
  //     setError(getErrorMessage(err, 'Verification failed'));
  //   } finally {
  //     setLoading(false);
  //   }
  // };


 

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
      {/* 🔙 Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-blue-700 font-semibold hover:text-blue-900 transition"
      >
        <i className="fas fa-arrow-left"></i> Back to Home
      </button>

      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <i className="fas fa-heartbeat text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">CareConnect Pro</h1>
          <p className="text-gray-600 mt-2">Healthcare Communication Platform</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {info}
          </div>
        )}

        {/* {isVerificationStep ? (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the 6-digit code"
              />
              <p className="text-xs text-gray-500 mt-2">
                Code sent to {verificationEmail}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.trim().length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsVerificationStep(false);
                setIsLoginMode(true);
                setVerificationCode('');
              }}
              className="w-full text-blue-600 hover:text-blue-700 font-semibold"
            >
              Back to Login
            </button>
          </form>
        ) : ( */}
          <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginMode && registerStep === 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required={!isLoginMode}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
              />
            </div>
          )}

          {(isLoginMode || registerStep === 1) &&(

            <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {emailLabel}
            </label>
            <input
              type={adminOnly ? 'text' : 'email'}
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={emailPlaceholder}
              />
          </div>
          )}

          {!isLoginMode && registerStep === 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Role {preselectedRole && (
                  <span className="text-blue-600">(Selected from landing page)</span>
                )}
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="patient">Patient</option>
                <option value="clinician">Clinician</option>
                {/* <option value="admin">Admin</option> */}
              </select>
            </div>
          )}

          {!isLoginMode &&  registerStep === 1 &&(
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Gender 
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="others">Others</option>
              </select>
            </div>
            
          )}  

        {(isLoginMode || registerStep === 1) && (
          <div className="relative">
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    Password
  </label>


  <input
    type={showPassword ? "text" : "password"}
    name="password"
    value={formData.password}
    onChange={handleChange}
    autoComplete="new-password"
    className="w-full px-4 py-3 pr-12 border rounded-lg"
  />

  <button
    type="button"
    onClick={() => setShowPassword(prev => !prev)}
    className="absolute right-4 top-[46px] text-gray-500 hover:text-gray-700"
  >
    <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
  </button>
</div>
          )}

          {isLoginMode && (
  <div className="text-right mt-2">
    <button
      type="button"
      onClick={() => navigate("/forgot-password")}
      className="text-sm text-blue-600 hover:underline"
    >
      Forgot Password?
    </button>
  </div>
)}
            {!isLoginMode && registerStep === 1 && formData.password && (
  <>
    <p className="text-xs text-gray-400 mt-2">
      Password must contain:
    </p>

    <ul className="text-xs mt-1 space-y-1">
      <li className={formData.password.length >= 8 ? "text-green-600" : "text-red-500"}>
        • At least 8 characters
      </li>
      <li className={/[A-Z]/.test(formData.password) ? "text-green-600" : "text-red-500"}>
        • One uppercase letter
      </li>
      <li className={/[a-z]/.test(formData.password) ? "text-green-600" : "text-red-500"}>
        • One lowercase letter
      </li>
      <li className={/[0-9]/.test(formData.password) ? "text-green-600" : "text-red-500"}>
        • One number
      </li>
      <li className={/[!@#$%^&*]/.test(formData.password) ? "text-green-600" : "text-red-500"}>
        • One special character
      </li>
    </ul>
  </>
)}


          {!isLoginMode && registerStep === 1 && (
           <div className="relative">
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    Confirm Password
  </label>

  <input
    type={showConfirmPassword ? "text" : "password"}
    name="confirmPassword"
    value={formData.confirmPassword}
    onChange={handleChange}
    autoComplete="new-password"
    className="w-full px-4 py-3 pr-12 border rounded-lg"
  />

  <button
    type="button"
    onClick={() => setShowConfirmPassword(prev => !prev)}
    className="absolute right-4 top-[46px] text-gray-500 hover:text-gray-700"
  >
    <i className={`fas ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"}`} />
  </button>
           
           
                {!isLoginMode && registerStep === 1 &&
  formData.confirmPassword &&
  formData.password !== formData.confirmPassword && (
    <p className="text-red-500 text-xs mt-1">
      Passwords do not match
    </p>
)}

            </div>
          )}

  {!isLoginMode && formData.role === "clinician" && registerStep === 2 && (
  <div className="space-y-4">
    <div className="text-center mb-4">
      <h2 className="text-xl font-bold text-gray-800">
        Professional Information
      </h2>
      <p className="text-sm text-gray-500">
        Please complete your clinician profile
      </p>
    </div>

    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Specialization
      </label>
      <input
        type="text"
        name="specialization"
        value={formData.specialization}
        onChange={handleChange}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="Cardiology, Neurology, General Medicine"
      />
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
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="Emergency, ICU, Outpatient"
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
        min="0"
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="5"
      />
    </div>

         <button
      type="button"
      onClick={() => setRegisterStep(1)}
      className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold transition"
    >
      Back
    </button>
  </div>
)}

         <button
  type="submit"
  disabled={
    loading ||
    (isLoginMode
      ? !isLoginFormValid
      : formData.role === "clinician" && registerStep === 2
        ? !isClinicianProfessionalStepValid
        : !isRegisterFormValid)
  }
  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition disabled:opacity-50"
>
  {loading
    ? "Processing..."
    : isLoginMode
      ? "Login"
      : formData.role === "clinician" && registerStep === 1
        ? "Next"
        : "Register"}
</button>
        </form>
        

        { !adminOnly && (
          <>
            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  const res = await axios.post(
                    "/api/auth/google",
                    {
                      token: credentialResponse.credential, // Google ID token
                      role: formData.role,
                    }
                  );

                  if (!PUBLIC_ROLES.includes(res.data.user.role)) {
                    setError("Use the admin portal to sign in.");
                    return;
                  }

                  completeExternalLogin(
                    res.data.access_token,
                    res.data.user,
                  );
                  navigateToHome(res.data.user.role);

                  
                } catch (err) {
                  console.error(err);
                  setError("Google Sign-In failed");
                }
              }}
              onError={() => {
                setError("Google Sign-In failed");
              }}
            />
          </>
        )}

        

        { !adminOnly && (
          <div className="mt-6 text-center">
          <p className="text-gray-600">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-blue-600 hover:text-blue-700 font-semibold"
              type="button"
            >
              {isLoginMode ? 'Register' : 'Login'}
            </button>
          </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
