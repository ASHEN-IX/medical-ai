"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";

interface Props {
  roomId: string;
  userId: string;
  userRole?: string;
}

export default function TeleconsultationRoom({ roomId, userId, userRole }: Props) {
  const { socket, connected } = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState<"connecting" | "active" | "ended">("connecting");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ],
  };

  const createPeerConnection = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("iceCandidate", { roomId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setStatus("active");
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== "stable") return;
        makingOffer.current = true;
        await pc.setLocalDescription();
        socket?.emit("offer", { roomId, offer: pc.localDescription });
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer.current = false;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [roomId, socket]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupStream() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    }
    setupStream();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!socket || !connected || !localStream) return;

    const pc = createPeerConnection();

    socket.emit("joinRoom", { roomId }, (response: any) => {
      if (pc.signalingState === "closed") return;
      localStream.getTracks().forEach((track) => {
        if (pc.signalingState !== "closed") {
          pc.addTrack(track, localStream);
        }
      });
    });

    socket.on("offer", async ({ offer }) => {
      try {
        const pc = peerConnection.current;
        if (!pc || pc.signalingState === "closed") return;

        const description = new RTCSessionDescription(offer);
        const offerCollision = (description.type === "offer") &&
                               (makingOffer.current || pc.signalingState !== "stable");

        // The doctor is IMPOLITE (ignores incoming offers on collision)
        // The patient is POLITE (yields and accepts incoming offers on collision)
        ignoreOffer.current = userRole === "DOCTOR" && offerCollision;
        if (ignoreOffer.current) {
          console.log("Ignoring offer due to collision (impolite peer)");
          return;
        }

        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          socket.emit("answer", { roomId, answer: pc.localDescription });
        }
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.on("answer", async ({ answer }) => {
      try {
        const pc = peerConnection.current;
        if (!pc || pc.signalingState === "closed") return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("iceCandidate", async ({ candidate }) => {
      try {
        const pc = peerConnection.current;
        if (!pc || pc.signalingState === "closed") return;
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (!ignoreOffer.current) {
          console.error("Error adding ICE candidate:", err);
        }
      }
    });

    return () => {
      socket.emit("leaveRoom", { roomId });
      socket.off("offer");
      socket.off("answer");
      socket.off("iceCandidate");
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
    };
  }, [socket, connected, roomId, localStream, createPeerConnection, userRole]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const retryConnection = () => {
    window.location.reload();
  };

  return (
    <div className="relative flex h-[640px] w-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-cyan-500/5 group">
      {/* Remote Video (Full Size) */}
      <div className="relative flex-1 bg-slate-900">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover grayscale-[0.2] transition-all duration-700 group-hover:grayscale-0"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 bg-slate-950/80 backdrop-blur-xl">
            <div className="relative">
              <div className="h-20 w-20 animate-ping rounded-full bg-cyan-500/20 absolute inset-0" />
              <div className="h-20 w-20 rounded-full border-2 border-cyan-500/30 flex items-center justify-center relative">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              </div>
            </div>
            <div className="text-center px-6">
              <p className="text-lg font-black text-white uppercase tracking-[0.2em]">Establishing Link</p>
              <p className="text-xs text-white/40 mt-1">Waiting for participant to join encrypted channel...</p>
              <button 
                onClick={retryConnection}
                className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest hover:bg-cyan-500/20 transition-all"
              >
                Force Re-Sync
              </button>
            </div>
          </div>
        )}
        
        <div className="absolute left-8 top-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-5 py-2.5 backdrop-blur-xl">
          <div className={`h-2 w-2 rounded-full ${remoteStream ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'} animate-pulse`} />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            {remoteStream ? 'Secure Uplink Active' : 'Signal Standby'}
          </span>
        </div>
      </div>

      {/* Local Video (Floating) */}
      <div className="absolute bottom-24 right-6 h-32 w-48 overflow-hidden rounded-2xl border-2 border-white/20 bg-slate-900 shadow-2xl transition-transform hover:scale-105">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <svg className="h-8 w-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6 rounded-3xl border border-white/10 bg-black/60 px-10 py-5 backdrop-blur-2xl transition-all duration-300 hover:bg-black/70 hover:border-white/20">
        <button
          onClick={toggleMute}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 ${
            isMuted ? "border-red-500/50 bg-red-500/20 text-red-400" : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:scale-110"
          }`}
        >
          {isMuted ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V7.5c0-.88.71-1.59 1.59-1.59h2.24Z" /></svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V7.5c0-.88.71-1.59 1.59-1.59h2.24Z" /></svg>
          )}
        </button>

        <button
          onClick={() => window.location.reload()}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-white shadow-xl shadow-red-600/30 transition-all duration-300 hover:bg-red-500 hover:scale-110 active:scale-95"
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <button
          onClick={toggleVideo}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 ${
            isVideoOff ? "border-red-500/50 bg-red-500/20 text-red-400" : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:scale-110"
          }`}
        >
          {isVideoOff ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 10.5 20.47 5.78a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V7.5a2.25 2.25 0 0 1 2.25-2.25H12a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25Z" /></svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}
