import React, { useEffect, useState } from "react";
import axios from "axios";

const RecordVersionHistory = ({ record, onClose, onVersionUploaded }) => {
  const [versions, setVersions] = useState([]);
  const [recordInfo, setRecordInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [changeNotes, setChangeNotes] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("access_token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const loadVersions = async () => {
    if (!record?.id) return;

    try {
      setLoading(true);
      setError("");

      const res = await axios.get(
        `/api/records/${record.id}/versions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setRecordInfo(res.data.record);
      setVersions(res.data.versions || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load record versions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [record?.id]);

  const handleUploadVersion = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("change_notes", changeNotes || "Updated record version");

      await axios.post(
        `/api/records/${record.id}/versions`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setMessage("New version uploaded successfully");
      setSelectedFile(null);
      setChangeNotes("");

      await loadVersions();

      if (onVersionUploaded) {
        onVersionUploaded();
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to upload new version");
    } finally {
      setUploading(false);
    }
  };

  const downloadVersion = async (version) => {
    try {
      const response = await axios.get(
        `/api/records/versions/${version.id}/download`,
        { responseType: "blob" },
      );
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = version.file_name || `record-version-${version.id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to download version");
    }
  };

 const deleteVersion = async (versionId) => {
  if (!window.confirm("Are you sure you want to delete this version?")) {
    return;
  }

  try {
    setError("");
    setMessage("");

    await axios.delete(
      `/api/records/versions/${versionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setMessage("Version deleted successfully");
    await loadVersions();
  } catch (err) {
    console.log("DELETE VERSION ERROR:", err.response?.data);
    setError(err.response?.data?.detail || "Failed to delete version");
  }
};

  const formatFileSize = (size) => {
    if (!size) return "N/A";

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <i className="fas fa-code-branch"></i>
                Medical Record Version History
              </h2>

              <p className="text-sm opacity-90 mt-1">
                {recordInfo?.name || record?.name || "Medical Record"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-lg">
              {message}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <h3 className="font-bold text-gray-800 mb-3">Record Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-semibold text-gray-800">
                  {recordInfo?.name || record?.name}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-semibold text-gray-800">
                  {recordInfo?.type || record?.type}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Category</p>
                <p className="font-semibold text-gray-800">
                  {recordInfo?.category || record?.category}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Total Versions</p>
                <p className="font-semibold text-gray-800">
                  {versions.length}
                </p>
              </div>
            </div>
          </div>

          {user?.role === "patient" && (
            <form
              onSubmit={handleUploadVersion}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
            >
              <h3 className="font-bold text-gray-800 mb-4">
                Upload New Version
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Updated File
                  </label>

                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Change Notes
                  </label>

                  <input
                    type="text"
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    placeholder="Example: Uploaded latest blood report"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                <i className="fas fa-upload mr-2"></i>
                {uploading ? "Uploading..." : "Upload New Version"}
              </button>
            </form>
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">
                Version Timeline
              </h3>

              <button
                onClick={loadVersions}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
              >
                <i className="fas fa-sync-alt mr-2"></i>
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">
                Loading versions...
              </div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <i className="fas fa-code-branch text-4xl text-gray-300 mb-3"></i>
                <p>No versions found for this record.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                      version.is_latest ? "bg-green-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          version.is_latest
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <i className="fas fa-file-medical"></i>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-800">
                            Version {version.version_number}
                          </h4>

                          {version.is_latest && (
                            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                              Latest
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mt-1">
                          {version.file_name}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          Uploaded by {version.uploaded_by} •{" "}
                          {version.uploaded_at
                            ? new Date(version.uploaded_at).toLocaleString()
                            : "N/A"}{" "}
                          • {formatFileSize(version.file_size)}
                        </p>

                        {version.change_notes && (
                          <p className="text-sm text-gray-700 mt-2">
                            <span className="font-semibold">Notes:</span>{" "}
                            {version.change_notes}
                          </p>
                        )}

                        {version.analysis_summary && (
                          <p className="text-sm text-blue-700 mt-2 bg-blue-50 p-3 rounded-lg">
                            <span className="font-semibold">AI Summary:</span>{" "}
                            {version.analysis_summary}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadVersion(version)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        <i className="fas fa-download mr-2"></i>
                        Download
                      </button>

                      {user?.role === "patient" && !version.is_latest && (
                        <button
                          onClick={() => deleteVersion(version.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm"
                        >
                          <i className="fas fa-trash mr-2"></i>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordVersionHistory;
