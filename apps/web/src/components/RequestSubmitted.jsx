import React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';

const RequestSubmitted = () => {
  const navigate = useNavigate();
  const { state } = useLocation();

  // This page only makes sense right after a submission —
  // direct visits get sent back to the application form.
  if (!state?.email) {
    return <Navigate to="/clinician-join" replace />;
  }

  const { name, email, submittedAt } = state;
  const submittedOn = new Date(submittedAt || Date.now()).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const steps = [
    {
      icon: 'fa-file-circle-check',
      label: 'Submitted',
      detail: `Received ${submittedOn}`,
      status: 'done',
    },
    {
      icon: 'fa-user-shield',
      label: 'Under review',
      detail: 'Our admin team verifies your license and credentials',
      status: 'current',
    },
    {
      icon: 'fa-envelope-open-text',
      label: 'Decision by email',
      detail: 'You\u2019ll hear from us once the review is complete',
      status: 'upcoming',
    },
  ];

  const circleClasses = {
    done: 'bg-green-100 text-green-600',
    current: 'bg-blue-600 text-white ring-4 ring-blue-100',
    upcoming: 'bg-gray-100 text-gray-400',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <style>{`
        @keyframes ccp-pop { 0% { transform: scale(0); opacity: 0; } 80% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ccp-rise { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .ccp-pop { animation: ccp-pop .45s cubic-bezier(.2, .8, .3, 1.2) both; }
        .ccp-rise { animation: ccp-rise .5s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .ccp-pop, .ccp-rise { animation: none; } }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 max-w-lg w-full text-center ccp-rise">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 ccp-pop">
          <i className="fas fa-check text-green-600 text-3xl" aria-hidden="true"></i>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-2" role="status">
          Application submitted
        </h1>
        <p className="text-gray-600 mb-8">
          Thanks{name ? `, ${name}` : ''} — your request to join CareConnect Pro
          is now in our review queue.
        </p>

        {/* Application status tracker */}
        <div className="relative mb-8">
          <div
            className="absolute top-5 left-[16.67%] right-[16.67%] h-0.5 bg-gray-200"
            aria-hidden="true"
          />
          <div
            className="absolute top-5 left-[16.67%] right-1/2 h-0.5 bg-green-400"
            aria-hidden="true"
          />
          <ol className="relative grid grid-cols-3 gap-2">
            {steps.map((step) => (
              <li key={step.label} className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${circleClasses[step.status]} ${
                    step.status === 'current' ? 'animate-pulse' : ''
                  }`}
                >
                  <i className={`fas ${step.icon}`} aria-hidden="true"></i>
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-800">{step.label}</p>
                <p className="mt-1 text-xs text-gray-500 leading-snug">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* What happens next */}
        <div className="bg-blue-50 rounded-xl p-4 text-left mb-8">
          <p className="text-sm font-semibold text-blue-800 mb-1">
            <i className="fas fa-circle-info mr-2" aria-hidden="true"></i>
            What happens next
          </p>
          <p className="text-sm text-blue-900">
            No further action is needed from you. Once your application is
            reviewed, we&rsquo;ll email the decision to{' '}
            <span className="font-semibold break-all">{email}</span> — if
            you&rsquo;re approved, your sign-in details will be included.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          Back to Home
        </button>

        <p className="text-sm text-gray-600 mt-4">
          Already approved?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default RequestSubmitted;