import React, { useEffect, useState } from "react";
import axios from "axios";

const toneClasses = {
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  violet: "border-violet-100 bg-violet-50 text-violet-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  rose: "border-rose-100 bg-rose-50 text-rose-700",
};

const RoleDashboardWidgets = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axios
      .get("/api/dashboard/widgets")
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loading && !data) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">
            {data?.title || "Loading your work queue"}
          </h3>
          <p className="text-xs text-slate-500">
            Live priorities based on your role
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Live
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(data?.cards || Array.from({ length: 4 })).map((card, index) =>
          card ? (
            <div
              key={card.label}
              className={`rounded-xl border p-4 ${
                toneClasses[card.tone] || toneClasses.blue
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-black">{card.value}</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80">
                  <i className={`fas ${card.icon}`}></i>
                </span>
              </div>
              <p className="mt-2 text-xs opacity-80">{card.hint}</p>
            </div>
          ) : (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl bg-slate-100"
            ></div>
          ),
        )}
      </div>
    </section>
  );
};

export default RoleDashboardWidgets;
