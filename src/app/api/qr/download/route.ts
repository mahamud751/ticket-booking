import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = searchParams.get("pnr");
    const action = searchParams.get("action") || "view";
    const mobile = searchParams.get("mobile") === "true";
    const format = searchParams.get("format"); // 'json' for API requests

    if (!pnr) {
      return NextResponse.json(
        {
          success: false,
          error: "PNR is required",
        },
        { status: 400 }
      );
    }

    // Find booking
    const booking = await prisma.booking.findFirst({
      where: {
        pnr: pnr.toUpperCase(),
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

    // Check if this is a mobile device
    const userAgent = request.headers.get("user-agent") || "";
    const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const shouldHandleAsMobile = isMobileDevice || mobile || action === "mobile";

    console.log(`📱 QR Download Request: PNR=${pnr}, Action=${action}, Mobile=${shouldHandleAsMobile}, UserAgent=${userAgent}`);

    if (action === "download" || action === "mobile" || shouldHandleAsMobile) {
      // Prepare comprehensive ticket data for mobile
      const ticketData = {
        pnr: booking.pnr,
        passengerName: booking.passengerName,
        passengerPhone: booking.passengerPhone,
        passengerEmail: booking.passengerEmail,
        totalAmount: booking.totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        route: {
          origin: booking.schedule.route.origin.name,
          destination: booking.schedule.route.destination.name,
        },
        schedule: {
          departureTime: booking.schedule.departureTime.toISOString(),
          arrivalTime: booking.schedule.arrivalTime.toISOString(),
        },
        operator: booking.schedule.route.operator.name,
        busNumber: booking.schedule.bus.busNumber,
        seats: booking.seats.map((seat) => ({
          seatNumber: seat.seat?.seatNumber || "N/A",
          seatType: seat.seat?.seatType || "Regular",
          price: seat.price,
        })),
        passengers: booking.passengers?.map((passenger) => ({
          passengerName: passenger.passengerName,
          seatNumber: passenger.seat?.seatNumber || "N/A",
        })) || [{
          passengerName: booking.passengerName,
          seatNumber: booking.seats[0]?.seat?.seatNumber || "N/A",
        }],
      };

      if (action === "mobile" || shouldHandleAsMobile) {
        // Check if this is an API request for JSON data (from our mobile page)
        if (format === "json") {
          // Return JSON data for our mobile QR page
          return NextResponse.json({
            success: true,
            ticket: ticketData,
            mobile: {
              optimized: true,
              directView: true,
              downloadable: true
            }
          });
        }
        
        // For mobile QR scan requests, redirect to beautiful mobile QR landing page
        const mobileQRUrl = new URL(`/qr/${pnr}`, request.url);
        
        console.log(`📱 Mobile QR Request for PNR ${pnr}: Redirecting to ${mobileQRUrl.toString()}`);
        return NextResponse.redirect(mobileQRUrl.toString(), 302);
      } else {
        // For desktop/API requests, return JSON data
        return NextResponse.json({
          success: true,
          action: "download",
          ticket: ticketData,
          downloadUrl: `/booking/confirmation/${pnr}`,
          message: "Ticket found! Redirecting to download page...",
        });
      }
    }

    // Default: redirect to booking confirmation page with mobile parameter if needed
    const confirmationUrl = new URL(`/booking/confirmation/${pnr}`, request.url);
    if (shouldHandleAsMobile) {
      confirmationUrl.searchParams.set('mobile', 'true');
    }
    
    return NextResponse.redirect(confirmationUrl.toString(), 302);

  } catch (error) {
    console.error("QR download API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}