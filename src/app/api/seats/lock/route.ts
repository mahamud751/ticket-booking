import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const seatLockSchema = z.object({
  scheduleId: z.string().min(1),
  seatIds: z.array(z.string()).min(1).max(4), // Maximum 4 seats per booking
  sessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const validatedData = seatLockSchema.parse(body);

    const { scheduleId, seatIds, sessionId } = validatedData;

    // Check if schedule exists and is active
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        isActive: true,
        departureTime: {
          gt: new Date(),
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        {
          success: false,
          error: "Schedule not found or already departed",
        },
        { status: 404 }
      );
    }

    // Create seat locks (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // First, clean up expired locks
      await tx.seatLock.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      // Release any existing locks for this session to prevent conflicts
      await tx.seatLock.deleteMany({
        where: {
          sessionId,
        },
      });

      // Check if seats are available after cleanup
      const availableSeats = await tx.seatLayout.findMany({
        where: {
          id: {
            in: seatIds,
          },
          isAvailable: true,
          bookings: {
            none: {
              booking: {
                status: {
                  in: ["CONFIRMED", "PENDING"],
                },
              },
            },
          },
          locks: {
            none: {
              expiresAt: {
                gt: new Date(),
              },
            },
          },
        },
      });

      if (availableSeats.length !== seatIds.length) {
        const unavailableSeats = seatIds.filter(
          (seatId) => !availableSeats.some((seat) => seat.id === seatId)
        );
        throw new Error(
          `Seats ${unavailableSeats.join(", ")} are no longer available`
        );
      }

      // Create locks for all seats
      const lockData = seatIds.map((seatId) => ({
        seatLayoutId: seatId,
        userId: session?.user?.id,
        sessionId,
        expiresAt,
      }));

      await tx.seatLock.createMany({
        data: lockData,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        lockedSeats: seatIds,
        expiresAt: expiresAt.toISOString(),
        lockDurationMs: 5 * 60 * 1000, // 5 minutes in milliseconds
      },
    });
  } catch (error) {
    console.error("Seat lock API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("are no longer available")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Release seat locks
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: "Session ID is required",
        },
        { status: 400 }
      );
    }

    await prisma.seatLock.deleteMany({
      where: {
        sessionId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Seat locks released successfully",
    });
  } catch (error) {
    console.error("Error releasing seat locks:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
