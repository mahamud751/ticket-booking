import { NextApiRequest } from "next";
import { NextApiResponseServerIO } from "@/lib/socket";
import { Server as SocketIOServer } from "socket.io";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (!res.socket.server.io) {
    const io = new SocketIOServer(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
      },
    });

    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log("🔌 Socket connected:", socket.id);

      socket.on("join-schedule", (scheduleId: string) => {
        socket.join(`schedule-${scheduleId}`);
        console.log(`👥 User ${socket.id} joined schedule room: ${scheduleId}`);
      });

      socket.on("leave-schedule", (scheduleId: string) => {
        socket.leave(`schedule-${scheduleId}`);
        console.log(`👋 User ${socket.id} left schedule room: ${scheduleId}`);
      });

      socket.on(
        "seat-lock-attempt",
        (data: {
          scheduleId: string;
          seatIds: string[];
          sessionId: string;
          userName?: string;
        }) => {
          // Broadcast to all other users in the schedule room
          socket.to(`schedule-${data.scheduleId}`).emit("seats-being-locked", {
            seatIds: data.seatIds,
            sessionId: data.sessionId,
            userName: data.userName || "Another user",
            timestamp: new Date().toISOString(),
          });
        }
      );

      socket.on(
        "seat-lock-success",
        (data: {
          scheduleId: string;
          seatIds: string[];
          sessionId: string;
          expiresAt: string;
        }) => {
          socket.to(`schedule-${data.scheduleId}`).emit("seats-locked", {
            seatIds: data.seatIds,
            sessionId: data.sessionId,
            expiresAt: data.expiresAt,
            timestamp: new Date().toISOString(),
          });
        }
      );

      socket.on(
        "seat-unlock",
        (data: {
          scheduleId: string;
          seatIds: string[];
          sessionId: string;
        }) => {
          socket.to(`schedule-${data.scheduleId}`).emit("seats-unlocked", {
            seatIds: data.seatIds,
            sessionId: data.sessionId,
            timestamp: new Date().toISOString(),
          });
        }
      );

      socket.on(
        "booking-completed",
        (data: {
          scheduleId: string;
          seatIds: string[];
          bookingId: string;
        }) => {
          socket.to(`schedule-${data.scheduleId}`).emit("seats-booked", {
            seatIds: data.seatIds,
            bookingId: data.bookingId,
            timestamp: new Date().toISOString(),
          });
        }
      );

      socket.on("disconnect", () => {
        console.log("🔌 Socket disconnected:", socket.id);
      });
    });

    console.log("🚀 Socket.IO server initialized");
  }

  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};
