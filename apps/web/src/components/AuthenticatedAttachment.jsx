import React, { useEffect, useState } from "react";
import axios from "axios";

const AuthenticatedAttachment = ({ attachment }) => {
  const [objectUrl, setObjectUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let createdUrl = "";

    axios
      .get(`/api/chat/download/${attachment.id}`, { responseType: "blob" })
      .then((response) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(response.data);
        setObjectUrl(createdUrl);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.detail || "Attachment unavailable",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment.id]);

  const download = () => {
    if (!objectUrl) return;
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.file_name || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading) {
    return <span className="text-xs opacity-70">Loading attachment...</span>;
  }
  if (error) {
    return <span className="text-xs text-red-700">{error}</span>;
  }

  if (attachment.file_type === "image") {
    return (
      <div className="mt-2">
        <img
          src={objectUrl}
          alt={attachment.file_name}
          className="max-h-64 max-w-full rounded-lg border"
        />
        <button
          type="button"
          onClick={download}
          className="mt-2 text-xs font-semibold underline"
        >
          Download {attachment.file_name}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      className="mt-2 flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2 text-sm font-semibold"
    >
      <i className="fas fa-paperclip"></i>
      {attachment.file_name}
    </button>
  );
};

export default AuthenticatedAttachment;
