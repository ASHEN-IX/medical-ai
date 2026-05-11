"use client";

import { useState, useEffect } from "react";
import { bookTransportation, fetchMyTransportBookings, cancelTransportBooking } from "@/services/api";

import GPSCapture from "@/components/transportation/GPSCapture";

const VEHICLE_ICONS: Record<string, string> = { AMBULANCE: "🚑", MEDICAL_TAXI: "🚕", STANDARD: "🚗" };
const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-amber-400 bg-amber-500/10",
  CONFIRMED: "text-blue-400 bg-blue-500/10",
  IN_TRANSIT: "text-cyan-400 bg-cyan-500/10",
  COMPLETED: "text-emerald-400 bg-emerald-500/10",
  CANCELLED: "text-red-400 bg-red-500/10",
};

export default function TransportationPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vehicleType: "STANDARD",
    pickupAddress: "",
    destAddress: "",
    scheduledAt: "",
    notes: "",
    pickupLat: undefined as number | undefined,
    pickupLng: undefined as number | undefined,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyTransportBookings()
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGPSCapture = (lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, pickupLat: lat, pickupLng: lng }));
  };

  const handleBook = async () => {
    setSubmitting(true);
    try {
      const booking = await bookTransportation(form);
      setBookings([booking, ...bookings]);
      setShowForm(false);
      setForm({
        vehicleType: "STANDARD",
        pickupAddress: "",
        destAddress: "",
        scheduledAt: "",
        notes: "",
        pickupLat: undefined,
        pickupLng: undefined,
      });
    } catch {
      /* empty */
    }
    setSubmitting(false);
  };

  const handleCancel = async (id: string) => {
    await cancelTransportBooking(id);
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "CANCELLED" } : b));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Transportation</h1>
          <p className="mt-1 text-slate-400">Book transport to your appointments.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white"
        >
          {showForm ? "Cancel" : "+ Book Transport"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {(["AMBULANCE", "MEDICAL_TAXI", "STANDARD"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setForm({ ...form, vehicleType: type })}
                className={`rounded-xl border p-4 text-center transition ${
                  form.vehicleType === type ? "border-cyan-500 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="text-3xl">{VEHICLE_ICONS[type]}</span>
                <p className="mt-1 text-sm font-medium capitalize text-slate-200">{type.replace("_", " ").toLowerCase()}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-300">Pickup Address</label>
                <GPSCapture onCapture={handleGPSCapture} />
              </div>
              <input
                value={form.pickupAddress}
                onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                placeholder="Enter pickup location"
              />
              {typeof form.pickupLat === "number" && typeof form.pickupLng === "number" && (
                <p className="mt-1 text-[10px] text-cyan-400">📍 Coords: {form.pickupLat.toFixed(4)}, {form.pickupLng?.toFixed(4)}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Destination</label>
              <input
                value={form.destAddress}
                onChange={(e) => setForm({ ...form, destAddress: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                placeholder="Hospital or clinic address"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Scheduled Date/Time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                placeholder="Special requirements..."
              />
            </div>
          </div>
          <button
            onClick={handleBook}
            disabled={submitting || !form.pickupAddress || !form.destAddress || !form.scheduledAt}
            className="rounded-xl bg-cyan-600 px-6 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {submitting ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading...
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center text-slate-400">
          <p className="text-4xl mb-2">🚗</p>
          <p>No transportation bookings yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{VEHICLE_ICONS[b.vehicleType] || "🚗"}</span>
                  <div>
                    <p className="font-medium text-white">{b.pickupAddress} → {b.destAddress}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(b.scheduledAt).toLocaleString()}
                      {b.distanceKm && ` · ${b.distanceKm.toFixed(1)} km`}
                      {b.estimatedMins && ` · ~${b.estimatedMins} min`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] || ""}`}>
                    {b.status}
                  </span>
                  {b.status === "PENDING" && (
                    <button onClick={() => handleCancel(b.id)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
