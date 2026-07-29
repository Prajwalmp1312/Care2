import React, { useEffect, useState } from "react";

const CareConsentDialog = ({
  consent,
  busy = false,
  error = "",
  acceptLabel = "Accept and continue",
  onAccept,
  onCancel,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setConfirmed(false);
  }, [consent?.consent_type, consent?.version]);

  if (!consent) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="care-consent-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <i className="fas fa-shield-heart"></i>
          </div>
          <div>
            <h2
              id="care-consent-title"
              className="text-xl font-bold text-slate-900"
            >
              {consent.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Please review this one-time safety disclosure before continuing.
            </p>
          </div>
        </div>

        <ul className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {(consent.disclosures || []).map((disclosure) => (
            <li key={disclosure} className="flex items-start gap-2">
              <i className="fas fa-circle-info mt-1 text-blue-600"></i>
              <span>{disclosure}</span>
            </li>
          ))}
        </ul>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-slate-700">
            I have read and understand these disclosures and consent to
            continue.
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!confirmed || busy}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Continuing...
              </>
            ) : (
              acceptLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CareConsentDialog;
