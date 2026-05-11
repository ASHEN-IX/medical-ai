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
    setForm((prev) => ({ 
      ...prev, 
      pickupLat: lat, 
      pickupLng: lng,
      pickupAddress: `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`
    }));
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
    <div className="space-y-8 animate-in">
      <div className="glass-card p-8 border-cyan-500/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-500/80">Logistics & Mobility</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Medical Transportation</h1>
            <p className="mt-2 text-slate-400 font-medium">Book professional medical transport for your upcoming clinical appointments.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {showForm ? "Close Form" : "+ New Booking"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="glass-card p-8 space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {(["AMBULANCE", "MEDICAL_TAXI", "STANDARD"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setForm({ ...form, vehicleType: type })}
                className={`glass-card p-6 flex flex-col items-center justify-center transition-all ${
                  form.vehicleType === type ? "border-cyan-500/50 bg-cyan-500/10 scale-[1.02]" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="text-4xl">{VEHICLE_ICONS[type]}</span>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-300">{type.replace("_", " ")}</p>
              </button>
            ))}
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Pickup Location</label>
              <div className="flex gap-2">
                <input
                  value={form.pickupAddress}
                  onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition"
                  placeholder="Street address or name"
                />
                <div className="shrink-0">
                  <GPSCapture onCapture={handleGPSCapture} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Destination</label>
              <input
                value={form.destAddress}
                onChange={(e) => setForm({ ...form, destAddress: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition"
                placeholder="Hospital or clinic name"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Appointment Time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Additional Instructions</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition"
                placeholder="Oxygen required, wheelchair access, etc."
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleBook}
              disabled={submitting || !form.pickupAddress || !form.destAddress || !form.scheduledAt}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-12 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-12 text-slate-400">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="font-medium">Loading transport data...</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass-card py-20 text-center text-slate-500 border-dashed">
          <p className="text-5xl mb-4 grayscale opacity-50">🚗</p>
          <p className="font-medium">No transportation bookings found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookings.map((b) => (
            <div key={b.id} className="glass-card p-6 hover:bg-white/10 transition-all group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                    {VEHICLE_ICONS[b.vehicleType] || "🚗"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg text-white">{b.pickupAddress}</p>
                      <span className="text-slate-600">→</span>
                      <p className="font-bold text-lg text-white">{b.destAddress}</p>
                    </div>
                    <p className="text-sm text-slate-400 font-medium mt-1">
                      {new Date(b.scheduledAt).toLocaleDateString()} at {new Date(b.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {b.distanceKm && <span className="mx-2 text-slate-700">|</span>}
                      {b.distanceKm && <span>{b.distanceKm.toFixed(1)} km journey</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-white/5 ${STATUS_COLORS[b.status] || ""}`}>
                    {b.status}
                  </span>
                  {b.status === "PENDING" && (
                    <button 
                      onClick={() => handleCancel(b.id)} 
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                      title="Cancel Booking"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
