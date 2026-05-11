"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";

interface Props {
  roomId: string;
  userId: string;
}

export default function TeleconsultationRoom({ roomId, userId }: Props) {
  const { socket, connected } = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState<"connecting" | "active" | "ended">("connecting");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const videoElement = remoteVideoRef as React.RefObject<HTMLVideoElement & { srcObject: MediaStream | null }>;
  const localVideoElement = localVideoRef as React.RefObject<HTMLVideoElement & { srcObject: MediaStream | null }>;

  const configuration: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("iceCandidate", { roomId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return pc;
  }, [roomId, socket]);

  const startCall = useCallback(async () => {
    if (!socket || !localStream) return;

    peerConnection.current = createPeerConnection();
    localStream.getTracks().forEach((track) => {
      peerConnection.current?.addTrack(track, localStream);
    });

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", { roomId, offer });
    setStatus("active");
  }, [localStream, roomId, socket, createPeerConnection]);

  useEffect(() => {
    async function setupStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
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
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (localVideoElement.current) {
      localVideoElement.current.srcObject = localStream;
    }
  }, [localStream, localVideoElement]);

  useEffect(() => {
    if (videoElement.current) {
      videoElement.current.srcObject = remoteStream;
    }
  }, [remoteStream, videoElement]);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit("joinRoom", { roomId });

    socket.on("userJoined", () => {
      startCall();
    });

    socket.on("offer", async ({ offer, from }) => {
      if (!peerConnection.current) {
        peerConnection.current = createPeerConnection();
        localStream?.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, localStream);
        });
      }
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
      setStatus("active");
    });

    socket.on("answer", async ({ answer }) => {
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("iceCandidate", async ({ candidate }) => {
      await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      socket.emit("leaveRoom", { roomId });
      socket.off("userJoined");
      socket.off("offer");
      socket.off("answer");
      socket.off("iceCandidate");
    };
  }, [socket, connected, roomId, localStream, startCall, createPeerConnection]);

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

  return (
    <div className="relative flex h-[600px] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-cyan-500/10">
      {/* Remote Video (Full Size) */}
      <div className="relative flex-1 bg-slate-800">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-900/60 backdrop-blur-md">
            <div className="h-16 w-16 animate-pulse rounded-full bg-cyan-500/20" />
            <p className="text-sm font-medium text-white/40">Waiting for participant...</p>
          </div>
        )}
        
        {/* Remote Info Overlay */}
        <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 backdrop-blur-md">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-white">Live Session</span>
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
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 border-t border-white/10 bg-black/40 px-8 py-6 backdrop-blur-xl">
        <button
          onClick={toggleMute}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
            isMuted ? "border-red-500/50 bg-red-500/20 text-red-400" : "border-white/10 bg-white/5 text-white hover:bg-white/10"
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
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 transition-transform hover:scale-110 active:scale-95"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
        </button>

        <button
          onClick={toggleVideo}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
            isVideoOff ? "border-red-500/50 bg-red-500/20 text-red-400" : "border-white/10 bg-white/5 text-white hover:bg-white/10"
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

