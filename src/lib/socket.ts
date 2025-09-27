import { Server as NetServer } from "http";
import { NextApiResponse, NextApiRequest } from "next";
import { Server as SocketIOServer } from "socket.io";

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function SocketHandler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (res.socket.server.io) {
    console.log("Socket is already running");
  } else {
    console.log("Socket is initializing");
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
      console.log("User connected:", socket.id);

      // Join schedule room for real-time updates
      socket.on("join-schedule", (scheduleId: string) => {
        socket.join(`schedule-${scheduleId}`);
        console.log(`User ${socket.id} joined schedule ${scheduleId}`);
      });

      // Leave schedule room
      socket.on("leave-schedule", (scheduleId: string) => {
        socket.leave(`schedule-${scheduleId}`);
        console.log(`User ${socket.id} left schedule ${scheduleId}`);
      });

      // Handle seat selection
      socket.on(
        "seat-selected",
        (data: { scheduleId: string; seatId: string; sessionId: string }) => {
          socket.to(`schedule-${data.scheduleId}`).emit("seat-locked", {
            seatId: data.seatId,
            sessionId: data.sessionId,
            lockedAt: new Date().toISOString(),
          });
        }
      );

      // Handle seat deselection
      socket.on(
        "seat-deselected",
        (data: { scheduleId: string; seatId: string; sessionId: string }) => {
          socket.to(`schedule-${data.scheduleId}`).emit("seat-unlocked", {
            seatId: data.seatId,
            sessionId: data.sessionId,
          });
        }
      );

      // Handle booking completion
      socket.on(
        "booking-completed",
        (data: { scheduleId: string; seatIds: string[] }) => {
          socket.to(`schedule-${data.scheduleId}`).emit("seats-booked", {
            seatIds: data.seatIds,
            bookedAt: new Date().toISOString(),
          });
        }
      );

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });
  }
  res.end();
}
