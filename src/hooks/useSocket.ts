"use client";

import { useEffect, useRef } from "react";
import io from "socket.io-client";

export interface SocketEvents {
  "seats-being-locked": (data: {
    seatIds: string[];
    sessionId: string;
    userName: string;
    timestamp: string;
  }) => void;

  "seats-locked": (data: {
    seatIds: string[];
    sessionId: string;
    expiresAt: string;
    timestamp: string;
  }) => void;

  "seats-unlocked": (data: {
    seatIds: string[];
    sessionId: string;
    timestamp: string;
  }) => void;

  "seats-booked": (data: {
    seatIds: string[];
    bookingId: string;
    timestamp: string;
  }) => void;
}

export const useSocket = (scheduleId?: string) => {
  const socketRef = useRef<typeof io.Socket | null>(null);

  useEffect(() => {
    if (!scheduleId) return;

    // Initialize socket connection
    const socket = io(
      process.env.NODE_ENV === "production" ? "" : "http://localhost:3000",
      {
        path: "/api/socketio",
      }
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Connected to socket server");
      socket.emit("join-schedule", scheduleId);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Disconnected from socket server");
    });

    return () => {
      socket.emit("leave-schedule", scheduleId);
      socket.disconnect();
    };
  }, [scheduleId]);

  const emit = (event: string, data: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  const on = <T extends keyof SocketEvents>(
    event: T,
    callback: SocketEvents[T]
  ) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback?: () => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    socket: socketRef.current,
    emit,
    on,
    off,
    isConnected: socketRef.current?.connected || false,
  };
};
