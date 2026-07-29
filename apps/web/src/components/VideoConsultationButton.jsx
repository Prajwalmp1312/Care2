import React, { useState } from "react";
import axios from "axios";
import CareConsentDialog from "./CareConsentDialog";

const formatLaunchTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const VideoConsultationButton = ({ appointment }) => {
  const [consent, setConsent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (
    appointment?.appointment_type !== "video_call" ||
    appointment?.status !== "approved"
  ) {
    return null;
  }

  const openAuthorizedConsultation = async ({
    acceptConsent = false,
    existingWindow = null,
  } = {}) => {
    const consultationWindow =
      existingWindow || window.open("about:blank", "_blank");
    if (consultationWindow && !existingWindow) {
      consultationWindow.opener = null;
    }

    try {
      setBusy(true);
      setError("");

      if (acceptConsent) {
        await axios.post("/api/consents/video_consultation", {
          accepted: true,
          consent_version: consent?.version,
        });
      }

      const response = await axios.post(
        `/api/video-consultations/appointments/${appointment.id}/launch`,
      );
      if (!consultationWindow) {
        throw new Error(
          "Your browser blocked the consultation window. Allow pop-ups and try again.",
        );
      }
      consultationWindow.location.replace(response.data.launch_url);
      setConsent(null);
    } catch (err) {
      consultationWindow?.close();
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to launch the video consultation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const beginLaunch = async () => {
    const consultationWindow = window.open("about:blank", "_blank");
    if (consultationWindow) consultationWindow.opener = null;
    try {
      setBusy(true);
      setError("");
      const response = await axios.get("/api/consents/video_consultation");
      if (!response.data.accepted) {
        consultationWindow?.close();
        setConsent(response.data);
        return;
      }
      await openAuthorizedConsultation({ existingWindow: consultationWindow });
    } catch (err) {
      consultationWindow?.close();
      setError(
        err.response?.data?.detail ||
          "Unable to verify video consultation consent.",
      );
    } finally {
      setBusy(false);
    }
  };

  const isAvailable = Boolean(appointment.video_launch_available);

  return (
    <div className="min-w-36">
      <button
        type="button"
        onClick={beginLaunch}
        disabled={!isAvailable || busy}
        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <i
          className={`fas ${
            busy ? "fa-spinner fa-spin" : "fa-video"
          } mr-2`}
        ></i>
        {busy ? "Checking..." : "Join video"}
      </button>

      {!isAvailable && (
        <p className="mt-1 max-w-44 text-xs leading-4 text-slate-500">
          Opens {formatLaunchTime(appointment.video_launch_opens_at)}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 max-w-48 text-xs text-red-600">
          {error}
        </p>
      )}

      <CareConsentDialog
        consent={consent}
        busy={busy}
        error={error}
        acceptLabel="Accept and open Comm360"
        onCancel={() => {
          setConsent(null);
          setError("");
        }}
        onAccept={() => openAuthorizedConsultation({ acceptConsent: true })}
      />
    </div>
  );
};

export default VideoConsultationButton;
