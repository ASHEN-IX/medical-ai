"use client";

import React, { useState } from "react";

interface Props {
  onCapture: (lat: number, lng: number) => void;
}

export default function GPSCapture({ onCapture }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const captureLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onCapture(latitude, longitude);
        setLoading(false);
        setStatus("success");
      },
      (error) => {
        console.error("GPS Error:", error);
        setLoading(false);
        setStatus("error");
      }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={captureLocation}
        disabled={loading}
        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
          status === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : status === "error"
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : "border-white/10 bg-white/5 text-white hover:bg-white/10"
        }`}
      >
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        {loading ? "Locating..." : status === "success" ? "Location Captured" : "Use Current Location"}
      </button>
      {status === "error" && (
        <p className="text-[10px] text-red-400">Failed to get location. Please allow GPS access.</p>
      )}
    </div>
  );
}
