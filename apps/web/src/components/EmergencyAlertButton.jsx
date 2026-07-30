import React, { useEffect, useState } from "react";
import axios from "axios";
import CareConsentDialog from "./CareConsentDialog";

const EmergencyAlertButton = ({ onAlertCreated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [consentAccepted, setConsentAccepted] = useState(null);
  const [consent, setConsent] = useState(null);
  const [consentError, setConsentError] = useState("");
  const [activeAlert, setActiveAlert] = useState(null);
  const [showFalseAlarmConfirm, setShowFalseAlarmConfirm] = useState(false);

  const requestHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
  });

  useEffect(() => {
    let active = true;
    axios
      .get("/api/consents/emergency_alert", {
        headers: requestHeaders(),
      })
      .then((response) => {
        if (active) setConsentAccepted(Boolean(response.data.accepted));
      })
      .catch(() => {
        if (active) setConsentAccepted(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadOpenAlert = async () => {
    try {
      const response = await axios.get("/api/emergency-alerts/my-open", {
        headers: requestHeaders(),
      });
      setActiveAlert(response.data.active ? response.data.alert : null);
      if (!response.data.active) setShowFalseAlarmConfirm(false);
    } catch (err) {
      console.error(
        "Unable to check SOS status:",
        err.response?.data || err,
      );
    }
  };

  useEffect(() => {
    loadOpenAlert();
    const poller = window.setInterval(loadOpenAlert, 15000);
    return () => window.clearInterval(poller);
  }, []);

  const postSos = async () => {
    const response = await axios.post(
      "/api/emergency-alerts",
      {
        alert_type: "medical_emergency",
        severity: "critical",
        message:
          "SOS activated by the patient. Immediate assistance may be required.",
      },
      { headers: requestHeaders() },
    );

    setFeedback({
      type: "success",
      message:
        response.data.notice ||
        "SOS sent. Your care team and administrators were notified.",
    });
    setActiveAlert({
      id: response.data.alert_id,
      status: response.data.status,
      escalation_level: response.data.escalation_level || 1,
    });
    window.dispatchEvent(new Event("careconnect:notifications-updated"));
    onAlertCreated?.();
  };

  const reportFalseAlarm = async () => {
    if (!activeAlert || submitting) return;
    try {
      setSubmitting(true);
      const response = await axios.put(
        `/api/emergency-alerts/${activeAlert.id}/false-alarm`,
        { confirmed: true },
        { headers: requestHeaders() },
      );
      setActiveAlert(null);
      setShowFalseAlarmConfirm(false);
      setFeedback({
        type: "success",
        message:
          response.data.notice ||
          "The SOS was closed as a false alarm and your care team was notified.",
      });
      window.dispatchEvent(new Event("careconnect:notifications-updated"));
    } catch (err) {
      console.error(
        "False alarm update failed:",
        err.response?.data || err,
      );
      setFeedback({
        type: "error",
        message:
          err.response?.data?.detail ||
          "Unable to close the SOS as a false alarm.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const triggerSos = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      setFeedback(null);
      setConsentError("");

      if (consentAccepted !== true) {
        const response = await axios.get(
          "/api/consents/emergency_alert",
          { headers: requestHeaders() },
        );
        if (!response.data.accepted) {
          setConsent(response.data);
          setConsentAccepted(false);
          return;
        }
        setConsentAccepted(true);
      }

      await postSos();
    } catch (err) {
      console.error("SOS alert failed:", err.response?.data || err);
      setFeedback({
        type: "error",
        message: err.response?.data?.detail || "Unable to send SOS. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const acceptConsentAndTrigger = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      setConsentError("");
      await axios.post(
        "/api/consents/emergency_alert",
        {
          accepted: true,
          consent_version: consent?.version,
        },
        { headers: requestHeaders() },
      );
      setConsentAccepted(true);
      setConsent(null);
      await postSos();
    } catch (err) {
      console.error("SOS consent failed:", err.response?.data || err);
      setConsentError(
        err.response?.data?.detail ||
          "Unable to save consent and send SOS. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={triggerSos}
        disabled={submitting}
        aria-label="Send SOS emergency alert"
        aria-describedby="sos-help-text"
        className="flex min-w-24 items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 font-black tracking-wide text-white shadow-lg shadow-red-200 transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-wait disabled:opacity-70"
      >
        <i
          className={`fas ${
            submitting ? "fa-spinner fa-spin" : "fa-circle-exclamation"
          }`}
        ></i>
        {submitting ? "SENDING" : "SOS"}
      </button>

      {activeAlert && (
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setShowFalseAlarmConfirm(true);
          }}
          disabled={submitting}
          className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
          title="Close an accidentally activated SOS"
        >
          <i className="fas fa-rotate-left mr-1"></i>
          False alarm
        </button>
      )}

      <span id="sos-help-text" className="sr-only">
        Sends a critical CareConnect alert without asking for emergency
        details. This does not automatically dispatch emergency services.
      </span>

      {showFalseAlarmConfirm && activeAlert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="false-alarm-title"
          className="absolute right-0 top-full z-[80] mt-3 w-80 rounded-xl border border-amber-200 bg-white p-4 text-sm shadow-2xl"
        >
          <h3
            id="false-alarm-title"
            className="font-bold text-slate-900"
          >
            Was the SOS activated accidentally?
          </h3>
          <p className="mt-2 leading-5 text-slate-600">
            Confirm only if no emergency assistance is needed. This closes
            CareConnect monitoring and notifies the care team, but it cannot
            cancel emergency services contacted outside CareConnect.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFalseAlarmConfirm(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
            >
              Keep SOS active
            </button>
            <button
              type="button"
              onClick={reportFalseAlarm}
              disabled={submitting}
              className="rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Confirm false alarm
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`absolute right-0 top-full z-[70] mt-3 w-72 rounded-xl border p-3 text-sm font-medium shadow-xl ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          <div className="flex items-start gap-2">
            <i
              className={`fas mt-0.5 ${
                feedback.type === "error"
                  ? "fa-triangle-exclamation"
                  : "fa-circle-check"
              }`}
            ></i>
            <span className="flex-1">{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="opacity-60 hover:opacity-100"
              aria-label="Dismiss SOS status"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      <CareConsentDialog
        consent={consent}
        busy={submitting}
        error={consentError}
        acceptLabel="Accept and send SOS"
        onCancel={() => {
          setConsent(null);
          setConsentError("");
        }}
        onAccept={acceptConsentAndTrigger}
      />
    </div>
  );
};

export default EmergencyAlertButton;
