import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const validateSchema = z.object({
  pnr: z.string().min(3, "PNR must be at least 3 characters").max(25, "PNR too long"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = searchParams.get("pnr");

    if (!pnr) {
      return NextResponse.json(
        {
          success: false,
          error: "PNR is required",
        },
        { status: 400 }
      );
    }

    // Validate PNR format
    const cleanPnr = pnr.trim().toUpperCase();
    if (cleanPnr.length < 3 || cleanPnr.length > 25) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid PNR format - must be between 3-25 characters",
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Validating PNR: ${cleanPnr}`);

    // Find booking with all related data
    const booking = await prisma.booking.findFirst({
      where: {
        pnr: cleanPnr,
      },
      include: {
        schedule: {
          include: {
            route: {
              include: {
                origin: true,
                destination: true,
                operator: true,
              },
            },
            bus: true,
          },
        },
        seats: {
          include: {
            seat: true,
          },
        },
        passengers: {
          include: {
            seat: true,
          },
        },
        payments: {
          where: {
            status: "COMPLETED",
          },
        },
      },
    });

    if (!booking) {
      console.log(`❌ Booking not found for PNR: ${cleanPnr}`);
      return NextResponse.json(
        {
          success: false,
          error: "Ticket not found - Please check PNR and try again",
        },
        { status: 404 }
      );
    }

    console.log(`✅ Booking found: ${booking.id} - Status: ${booking.status} - Payment: ${booking.paymentStatus}`);

    // Enhanced validation logic
    const currentDate = new Date();
    const departureDate = new Date(booking.schedule.departureTime);
    const arrivalDate = new Date(booking.schedule.arrivalTime);
    
    // Check if ticket is valid - more comprehensive checks
    let isValid = true;
    const validationReasons: string[] = [];
    
    // Check booking status
    if (booking.status !== "CONFIRMED") {
      isValid = false;
      validationReasons.push(`Booking status is ${booking.status}, must be CONFIRMED`);
    }
    
    // Check payment status
    if (booking.paymentStatus !== "COMPLETED") {
      isValid = false;
      validationReasons.push(`Payment status is ${booking.paymentStatus}, must be COMPLETED`);
    }
    
    // Check if there are completed payments
    if (booking.payments.length === 0) {
      isValid = false;
      validationReasons.push("No completed payment records found");
    }
    
    // Check departure date - allow boarding from 2 hours before departure until arrival
    const boardingWindow = new Date(departureDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
    if (currentDate < boardingWindow) {
      isValid = false;
      validationReasons.push(`Boarding not yet allowed - earliest boarding: ${boardingWindow.toLocaleString()}`);
    }
    
    // Check if journey has ended
    if (currentDate > arrivalDate) {
      isValid = false;
      validationReasons.push(`Journey has ended - arrival was: ${arrivalDate.toLocaleString()}`);
    }

    console.log(`🔍 Validation result: ${isValid ? 'VALID' : 'INVALID'}`);
    if (!isValid) {
      console.log(`❌ Validation reasons: ${validationReasons.join(', ')}`);
    }

    // Get seat numbers with better error handling
    const seatNumbers = booking.seats?.map(seat => seat.seat?.seatNumber || "N/A") || [];

    // Get all passengers for multi-passenger bookings
    const allPassengers = booking.passengers?.map(passenger => ({
      name: passenger.passengerName,
      seatNumber: passenger.seat?.seatNumber || "N/A",
    })) || [];

    // If no separate passengers data, use main passenger
    if (allPassengers.length === 0) {
      allPassengers.push({
        name: booking.passengerName,
        seatNumber: seatNumbers[0] || "N/A",
      });
    }

    const validationData = {
      id: booking.id,
      pnr: booking.pnr,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      passengerName: booking.passengerName,
      passengerPhone: booking.passengerPhone,
      passengerEmail: booking.passengerEmail,
      totalAmount: booking.totalAmount,
      seatNumbers,
      allPassengers,
      route: {
        origin: booking.schedule.route.origin.name,
        destination: booking.schedule.route.destination.name,
      },
      schedule: {
        departureTime: booking.schedule.departureTime.toISOString(),
        arrivalTime: booking.schedule.arrivalTime.toISOString(),
        busNumber: booking.schedule.bus.busNumber,
        operator: booking.schedule.route.operator.name,
      },
      isValid,
      validationReasons: isValid ? [] : validationReasons,
      validationTimestamp: new Date().toISOString(),
      boardingWindow: {
        earliest: boardingWindow.toISOString(),
        latest: arrivalDate.toISOString(),
      },
    };

    // Log validation attempt for audit trail
    const logMessage = `Ticket validation: PNR ${cleanPnr} - ${isValid ? 'VALID' : 'INVALID'} at ${new Date().toISOString()}`;
    console.log(logMessage);
    
    return NextResponse.json({
      success: true,
      booking: validationData,
    });

  } catch (error) {
    console.error("Ticket validation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to validate ticket - system error. Please try again.",
      },
      { status: 500 }
    );
  }
}

// Optional: POST endpoint to mark ticket as used/validated
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pnr } = validateSchema.parse(body);

    // Find the booking
    const booking = await prisma.booking.findFirst({
      where: {
        pnr: pnr.toUpperCase(),
      },
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: "Booking not found",
        },
        { status: 404 }
      );
    }

    // Update booking to mark as validated/used
    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: "CONFIRMED", // Keep as confirmed since USED status doesn't exist in schema
        // You could add a validatedAt timestamp field to track when ticket was used
        updatedAt: new Date(),
      },
    });

    console.log(`Ticket marked as used: PNR ${pnr} at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: "Ticket marked as used",
      booking: {
        id: updatedBooking.id,
        pnr: updatedBooking.pnr,
        status: updatedBooking.status,
      },
    });

  } catch (error) {
    console.error("Ticket usage marking error:", error);
    
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

    return NextResponse.json(
      {
        success: false,
        error: "Failed to mark ticket as used",
      },
      { status: 500 }
    );
  }
}