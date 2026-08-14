import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import DoctorCrossConsultSearch from "./DoctorCrossConsultSearch";
const resourceStyles = {
  record: { icon: "fa-file-medical", badge: "bg-blue-100 text-blue-700" },
  prescription: {
    icon: "fa-prescription-bottle-medical",
    badge: "bg-green-100 text-green-700",
  },
  appointment: {
    icon: "fa-calendar-check",
    badge: "bg-purple-100 text-purple-700",
  },
  patient: { icon: "fa-user", badge: "bg-orange-100 text-orange-700" },
};

const formatLabel = (value) =>
  value
    ? String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "";

const formatDateValue = (value) => {
  if (!value) return "";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;
  return new Date(normalized).toLocaleString();
};

const ClinicalSearch = ({
  user,
  onOpenPatient,
  onOpenRecord,
  compact = false,
  onViewAll,
}) => {
  const [query, setQuery] = useState("");
  const [resourceType, setResourceType] = useState("all");
  const [categoryCode, setCategoryCode] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ results: [], facets: {}, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        q: query || undefined,
        resource_types:
          resourceType === "all"
            ? "records,prescriptions,appointments,patients"
            : resourceType,
        category_code: categoryCode || undefined,
        status: status || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        patient_email: patientEmail || undefined,
        page_size: compact ? 5 : 100,
      };
      const response = await axios.get("/api/clinical/search", { params });
      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Clinical search failed",
      );
    } finally {
      setLoading(false);
    }
  }, [
    categoryCode,
    compact,
    dateFrom,
    dateTo,
    patientEmail,
    query,
    resourceType,
    status,
  ]);

  useEffect(() => {
    axios
      .get("/api/records/categories")
      .then((response) => setCategories(response.data.categories || []))
      .catch(() => setCategories([]));
    runSearch();
  }, []);

  const clearFilters = () => {
    setQuery("");
    setResourceType("all");
    setCategoryCode("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPatientEmail("");
  };

  const openResult = (result) => {
    if (result.resource_type === "patient" && onOpenPatient) {
      onOpenPatient({ email: result.patient_email, id: result.id });
    } else if (result.resource_type === "record" && onOpenRecord) {
      onOpenRecord(result.id);
    }
  };

  if (compact) {
    return (
      <section className="h-full rounded-xl border border-gray-100 bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <i className="fas fa-search"></i>
              </span>
              Clinical Search
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Find your records, prescriptions, and appointments.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            Full search
            <i className="fas fa-arrow-up-right-from-square ml-2 text-xs"></i>
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clinical data..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <select
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value)}
            aria-label="Clinical resource type"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          >
            <option value="all">All</option>
            <option value="records">Records</option>
            <option value="prescriptions">Prescriptions</option>
            <option value="appointments">Appointments</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {(data.results || []).slice(0, 4).map((result) => {
            const style =
              resourceStyles[result.resource_type] || resourceStyles.record;
            const canOpen =
              (result.resource_type === "patient" && onOpenPatient) ||
              (result.resource_type === "record" && onOpenRecord);

            return (
              <button
                type="button"
                key={`${result.resource_type}-${result.id}`}
                onClick={() => canOpen && openResult(result)}
                className={`flex w-full items-center gap-3 rounded-lg border border-gray-100 p-3 text-left ${
                  canOpen ? "hover:border-blue-200 hover:bg-blue-50" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <i className={`fas ${style.icon}`}></i>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-gray-800">
                    {result.title}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {formatLabel(result.resource_type)}
                    {result.date ? ` • ${formatDateValue(result.date)}` : ""}
                  </span>
                </span>
                {canOpen && (
                  <i className="fas fa-chevron-right text-xs text-gray-400"></i>
                )}
              </button>
            );
          })}

          {!loading && !data.results?.length && !error && (
            <div className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-500">
              No clinical items found.
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold">Clinical Search</h2>
        <p className="mt-1 text-sm text-blue-100">
          Search records, prescriptions, appointments, and patient profiles.
          Results are automatically limited to your role and care connections.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
        className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg"
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Search
            </label>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-3.5 text-gray-400"></i>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Record name, medication, reason, or patient..."
                className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Resource
            </label>
            <select
              value={resourceType}
              onChange={(event) => setResourceType(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3"
            >
              <option value="all">All resources</option>
              <option value="records">Medical records</option>
              <option value="prescriptions">Prescriptions</option>
              <option value="appointments">Appointments</option>
              <option value="patients">Patients</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Record category
            </label>
            <select
              value={categoryCode}
              onChange={(event) => setCategoryCode(event.target.value)}
              disabled={!["all", "records"].includes(resourceType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 disabled:bg-gray-100"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {user?.role !== "patient" && (
            <div className="lg:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                Patient email
              </label>
              <input
                type="email"
                value={patientEmail}
                onChange={(event) => setPatientEmail(event.target.value)}
                placeholder="Optional patient filter"
                className="w-full rounded-lg border border-gray-300 px-3 py-3"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Status
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-3"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-3"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
          >
            Search clinical data
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
      </form>
      {user?.role === "clinician" && (
                <DoctorCrossConsultSearch user={user} />
              )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Results</h3>
            <p className="text-sm text-gray-500">
              {data.total || 0} matching clinical items
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Searching...</div>
        ) : (
          <div className="space-y-3">
            {(data.results || []).map((result) => {
              const style =
                resourceStyles[result.resource_type] || resourceStyles.record;
              const canOpen =
                (result.resource_type === "patient" && onOpenPatient) ||
                (result.resource_type === "record" && onOpenRecord);
              return (
                <button
                  type="button"
                  key={`${result.resource_type}-${result.id}`}
                  onClick={() => canOpen && openResult(result)}
                  className={`w-full rounded-xl border border-gray-200 p-4 text-left transition ${
                    canOpen ? "hover:border-blue-300 hover:bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                      <i className={`fas ${style.icon}`}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-gray-800">
                          {result.title}
                        </h4>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}
                        >
                          {formatLabel(result.resource_type)}
                        </span>
                        {result.status && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {formatLabel(result.status)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                        {result.subtitle || "No additional summary"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                        {result.patient_email && (
                          <span>{result.patient_email}</span>
                        )}
                        {result.category && <span>{result.category}</span>}
                        {result.date && (
                          <span>{formatDateValue(result.date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {!data.results?.length && (
              <div className="py-12 text-center text-gray-500">
                No clinical items match the selected filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicalSearch;
