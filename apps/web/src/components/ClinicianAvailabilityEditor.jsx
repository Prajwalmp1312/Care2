import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const emptyDays = () =>
  Object.fromEntries(WEEKDAYS.map((day) => [day, []]));

const normalizeAvailability = (value = {}) => ({
  consultation_hours: {
    ...emptyDays(),
    ...(value.consultation_hours || {}),
  },
  consultation_breaks: {
    ...emptyDays(),
    ...(value.consultation_breaks || {}),
  },
  consultation_duration_minutes:
    value.consultation_duration_minutes || 30,
  appointment_timezone:
    value.appointment_timezone || "America/Los_Angeles",
});

const minutesFromTime = (value) => {
  const [hours, minutes] = String(value || "00:00")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
};

const timeFromMinutes = (value) => {
  const bounded = Math.max(0, Math.min(value, 23 * 60 + 59));
  return `${String(Math.floor(bounded / 60)).padStart(2, "0")}:${String(
    bounded % 60,
  ).padStart(2, "0")}`;
};

const defaultBreakForWindows = (windows, existingBreaks, label) => {
  const desiredLength = label === "Lunch" ? 60 : 15;
  const preferredStarts =
    label === "Lunch"
      ? [12 * 60, 13 * 60, 11 * 60 + 30]
      : [15 * 60, 10 * 60 + 30, 14 * 60 + 30];
  const overlapsExisting = (start, end) =>
    existingBreaks.some(
      (item) =>
        start < minutesFromTime(item.end) &&
        end > minutesFromTime(item.start),
    );

  for (const window of windows) {
    const start = minutesFromTime(window.start);
    const end = minutesFromTime(window.end);
    const candidates = [
      ...preferredStarts,
      ...Array.from(
        {
          length: Math.max(
            0,
            Math.floor((end - start - desiredLength) / 15) + 1,
          ),
        },
        (_, index) => start + index * 15,
      ),
    ];
    const breakStart = candidates.find(
      (candidate) =>
        candidate >= start &&
        candidate + desiredLength <= end &&
        !overlapsExisting(candidate, candidate + desiredLength),
    );
    if (breakStart !== undefined) {
      return {
        label,
        start: timeFromMinutes(breakStart),
        end: timeFromMinutes(breakStart + desiredLength),
      };
    }
  }
  return null;
};

const ClinicianAvailabilityEditor = () => {
  const [availability, setAvailability] = useState(
    normalizeAvailability(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const response = await axios.get("/api/clinician/availability");
      setAvailability(normalizeAvailability(response.data));
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.detail ||
          "Unable to load consultation hours.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailability();
  }, []);

  const activeDayCount = useMemo(
    () =>
      WEEKDAYS.filter(
        (day) => availability.consultation_hours[day]?.length,
      ).length,
    [availability.consultation_hours],
  );

  const setDayEnabled = (day, enabled) => {
    setFeedback(null);
    setAvailability((current) => ({
      ...current,
      consultation_hours: {
        ...current.consultation_hours,
        [day]: enabled
          ? current.consultation_hours[day]?.length
            ? current.consultation_hours[day]
            : [{ start: "09:00", end: "17:00" }]
          : [],
      },
      consultation_breaks: {
        ...current.consultation_breaks,
        [day]: enabled ? current.consultation_breaks[day] || [] : [],
      },
    }));
  };

  const updateEntry = (collection, day, index, field, value) => {
    setFeedback(null);
    setAvailability((current) => ({
      ...current,
      [collection]: {
        ...current[collection],
        [day]: current[collection][day].map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, [field]: value } : entry,
        ),
      },
    }));
  };

  const addConsultationWindow = (day) => {
    setFeedback(null);
    setAvailability((current) => {
      const windows = current.consultation_hours[day] || [];
      const previousEnd = windows.at(-1)?.end;
      const nextStart = previousEnd || "09:00";
      const nextEnd =
        nextStart === "09:00"
          ? "17:00"
          : timeFromMinutes(
              Math.min(minutesFromTime(nextStart) + 180, 23 * 60 + 45),
            );
      return {
        ...current,
        consultation_hours: {
          ...current.consultation_hours,
          [day]: [
            ...windows,
            { start: nextStart, end: nextEnd },
          ],
        },
      };
    });
  };

  const removeConsultationWindow = (day, index) => {
    setFeedback(null);
    setAvailability((current) => {
      const nextWindows = current.consultation_hours[day].filter(
        (_, entryIndex) => entryIndex !== index,
      );
      const nextBreaks = current.consultation_breaks[day].filter(
        (item) =>
          nextWindows.some(
            (window) =>
              minutesFromTime(item.start) >=
                minutesFromTime(window.start) &&
              minutesFromTime(item.end) <=
                minutesFromTime(window.end),
          ),
      );
      return {
        ...current,
        consultation_hours: {
          ...current.consultation_hours,
          [day]: nextWindows,
        },
        consultation_breaks: {
          ...current.consultation_breaks,
          [day]: nextBreaks,
        },
      };
    });
  };

  const addBreak = (day, label) => {
    setFeedback(null);
    const windows = availability.consultation_hours[day] || [];
    const existingBreaks = availability.consultation_breaks[day] || [];
    const nextBreak = defaultBreakForWindows(
      windows,
      existingBreaks,
      label,
    );
    if (!nextBreak) {
      setFeedback({
        type: "error",
        message: `There is no open time for another ${label.toLowerCase()} on ${day}.`,
      });
      return;
    }
    setAvailability((current) => ({
      ...current,
      consultation_breaks: {
        ...current.consultation_breaks,
        [day]: [
          ...(current.consultation_breaks[day] || []),
          nextBreak,
        ],
      },
    }));
  };

  const removeBreak = (day, index) => {
    setFeedback(null);
    setAvailability((current) => ({
      ...current,
      consultation_breaks: {
        ...current.consultation_breaks,
        [day]: current.consultation_breaks[day].filter(
          (_, entryIndex) => entryIndex !== index,
        ),
      },
    }));
  };

  const saveAvailability = async () => {
    try {
      setSaving(true);
      setFeedback(null);
      const response = await axios.put(
        "/api/clinician/availability",
        {
          consultation_hours: availability.consultation_hours,
          consultation_breaks: availability.consultation_breaks,
          consultation_duration_minutes:
            availability.consultation_duration_minutes,
        },
      );
      setAvailability(normalizeAvailability(response.data));
      setFeedback({
        type: "success",
        message:
          "Schedule saved. Patient appointment slots now exclude all breaks.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err.response?.data?.detail ||
          "Unable to update consultation hours.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        <i className="fas fa-spinner fa-spin mr-2"></i>
        Loading consultation schedule...
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <i className="fas fa-calendar-days"></i>
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Consultation schedule
              </h3>
              <p className="text-sm text-slate-600">
                {activeDayCount} active day
                {activeDayCount === 1 ? "" : "s"} ·{" "}
                {availability.appointment_timezone}
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-5 text-slate-600">
            Define bookable working sessions, then add lunch or shorter
            breaks. Patients will only see appointment slots outside these
            blocked periods.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          Appointment length
          <select
            value={availability.consultation_duration_minutes}
            onChange={(event) =>
              setAvailability((current) => ({
                ...current,
                consultation_duration_minutes: Number(
                  event.target.value,
                ),
              }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            {[15, 30, 45, 60].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>
      </div>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="space-y-3">
        {WEEKDAYS.map((day) => {
          const windows = availability.consultation_hours[day] || [];
          const breaks = availability.consultation_breaks[day] || [];
          const enabled = windows.length > 0;
          return (
            <article
              key={day}
              className={`rounded-xl border p-4 ${
                enabled
                  ? "border-blue-200 bg-white"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-3 font-bold capitalize text-slate-900">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) =>
                      setDayEnabled(day, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {day}
                </label>
                {enabled && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addBreak(day, "Lunch")}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                    >
                      <i className="fas fa-utensils mr-1"></i>
                      Add lunch
                    </button>
                    <button
                      type="button"
                      onClick={() => addBreak(day, "Break")}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100"
                    >
                      <i className="fas fa-mug-hot mr-1"></i>
                      Add break
                    </button>
                    <button
                      type="button"
                      onClick={() => addConsultationWindow(day)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      <i className="fas fa-plus mr-1"></i>
                      Add session
                    </button>
                  </div>
                )}
              </div>

              {enabled ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Bookable sessions
                    </p>
                    <div className="space-y-2">
                      {windows.map((window, index) => (
                        <div
                          key={`${day}-window-${index}`}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2"
                        >
                          <span className="text-xs font-bold text-emerald-700">
                            Session {index + 1}
                          </span>
                          <input
                            type="time"
                            value={window.start}
                            onChange={(event) =>
                              updateEntry(
                                "consultation_hours",
                                day,
                                index,
                                "start",
                                event.target.value,
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="time"
                            value={window.end}
                            onChange={(event) =>
                              updateEntry(
                                "consultation_hours",
                                day,
                                index,
                                "end",
                                event.target.value,
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          />
                          {windows.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removeConsultationWindow(day, index)
                              }
                              className="ml-auto rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove ${day} session ${index + 1}`}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Non-bookable breaks
                    </p>
                    {breaks.length ? (
                      <div className="space-y-2">
                        {breaks.map((item, index) => (
                          <div
                            key={`${day}-break-${index}`}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/70 p-2"
                          >
                            <select
                              value={item.label}
                              onChange={(event) =>
                                updateEntry(
                                  "consultation_breaks",
                                  day,
                                  index,
                                  "label",
                                  event.target.value,
                                )
                              }
                              className="rounded border border-amber-200 bg-white px-2 py-1.5 text-sm font-semibold text-amber-900"
                            >
                              <option value="Lunch">Lunch</option>
                              <option value="Break">Break</option>
                              <option value="Administrative block">
                                Admin block
                              </option>
                            </select>
                            <input
                              type="time"
                              value={item.start}
                              onChange={(event) =>
                                updateEntry(
                                  "consultation_breaks",
                                  day,
                                  index,
                                  "start",
                                  event.target.value,
                                )
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                            />
                            <span className="text-slate-400">to</span>
                            <input
                              type="time"
                              value={item.end}
                              onChange={(event) =>
                                updateEntry(
                                  "consultation_breaks",
                                  day,
                                  index,
                                  "end",
                                  event.target.value,
                                )
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeBreak(day, index)}
                              className="ml-auto rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove ${item.label} on ${day}`}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                        No breaks added for this day.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Not available for patient appointments.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-blue-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Schedule changes apply immediately to new appointment requests.
        </p>
        <button
          type="button"
          onClick={saveAvailability}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          <i
            className={`fas ${
              saving ? "fa-spinner fa-spin" : "fa-save"
            } mr-2`}
          ></i>
          {saving ? "Saving schedule..." : "Save schedule"}
        </button>
      </div>
    </section>
  );
};

export default ClinicianAvailabilityEditor;
