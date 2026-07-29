import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString() : "Unknown";

const describeDevice = (userAgent) => {
  if (!userAgent) return "Unknown device";
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const platform = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Mac OS")
      ? "macOS"
      : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("iPhone") || userAgent.includes("iPad")
          ? "iOS"
          : "device";
  return `${browser} on ${platform}`;
};

const SecuritySessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get("/api/auth/sessions");
      setSessions(response.data.sessions || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Unable to load active sessions",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const revokeSession = async (session) => {
    if (
      !window.confirm(
        `End the session for ${describeDevice(session.user_agent)}?`,
      )
    ) {
      return;
    }

    try {
      setRevokingId(session.id);
      await axios.delete(`/api/auth/sessions/${session.id}`);
      await loadSessions();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Unable to revoke the session",
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-blue-900 p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold">Security & Sessions</h2>
        <p className="mt-1 text-sm text-blue-100">
          Review signed-in devices and end sessions you no longer recognize.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Active sessions</h3>
            <p className="text-sm text-gray-500">
              Sessions automatically expire and can be revoked immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSessions}
            className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-gray-500">
            Loading sessions...
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-center ${
                  session.current
                    ? "border-blue-300 bg-blue-50"
                    : session.revoked
                      ? "border-gray-200 bg-gray-50 opacity-70"
                      : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <i className="fas fa-laptop-medical"></i>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-800">
                        {describeDevice(session.user_agent)}
                      </p>
                      {session.current && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                          Current
                        </span>
                      )}
                      {session.revoked && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          Revoked
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      IP {session.ip_address || "unknown"} · Last active{" "}
                      {formatDateTime(session.last_seen_at)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Expires {formatDateTime(session.expires_at)}
                    </p>
                  </div>
                </div>

                {!session.current && !session.revoked && (
                  <button
                    type="button"
                    disabled={revokingId === session.id}
                    onClick={() => revokeSession(session)}
                    className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {revokingId === session.id ? "Ending..." : "End session"}
                  </button>
                )}
              </div>
            ))}

            {!sessions.length && (
              <p className="py-10 text-center text-gray-500">
                No active sessions were found.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Revocable access", "Every sign-in has a server-side session that can be ended immediately."],
          ["Short-lived tokens", "Access tokens expire automatically and inactive accounts are rejected."],
          ["Audited activity", "Sensitive reads and account-changing requests are recorded for administrators."],
        ].map(([title, description]) => (
          <div
            key={title}
            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <h4 className="font-bold text-gray-800">{title}</h4>
            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecuritySessions;
