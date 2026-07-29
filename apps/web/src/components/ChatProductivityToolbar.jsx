import React from "react";

const templates = {
  clinician: [
    "Thank you for the update. I have reviewed your message.",
    "Please schedule a follow-up appointment so we can discuss this.",
    "If your symptoms worsen, seek urgent medical care.",
  ],
  patient: [
    "Could you help me understand these results?",
    "I would like to schedule a follow-up consultation.",
    "I have a question about my prescription.",
  ],
};

const ChatProductivityToolbar = ({
  role,
  searchTerm,
  onSearchChange,
  onUseTemplate,
  onExport,
  matchCount,
}) => (
  <div className="border-b bg-slate-50 px-3 py-2">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <i className="fas fa-search absolute left-3 top-2.5 text-xs text-gray-400"></i>
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search this conversation..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </div>
      {searchTerm && (
        <span className="text-xs font-medium text-gray-500">
          {matchCount} match{matchCount === 1 ? "" : "es"}
        </span>
      )}
      <button
        type="button"
        onClick={onExport}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
      >
        <i className="fas fa-file-export mr-2"></i>
        Export chat
      </button>
    </div>
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {(templates[role] || []).map((template) => (
        <button
          type="button"
          key={template}
          onClick={() => onUseTemplate(template)}
          className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          {template}
        </button>
      ))}
    </div>
  </div>
);

export default ChatProductivityToolbar;
