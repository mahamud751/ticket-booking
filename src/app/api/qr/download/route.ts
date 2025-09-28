import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = searchParams.get("pnr");
    const action = searchParams.get("action") || "view";
    const mobile = searchParams.get("mobile") === "true";

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
        // For mobile requests, return enhanced JSON data with multiple action options
        const response = {
          success: true,
          action: "mobile_download",
          ticket: ticketData,
          mobile: {
            optimized: true,
            directView: true,
            downloadable: true
          },
          urls: {
            webView: `/booking/confirmation/${pnr}?mobile=true`,
            download: `/booking/confirmation/${pnr}`,
            validation: `/api/bookings/validate?pnr=${pnr}`,
            scanner: `/qr-scanner?pnr=${pnr}`
          },
          qrData: {
            type: "bus-ticket",
            version: "2.0",
            pnr: pnr,
            mobileOptimized: true
          },
          message: "✅ Ticket found! Choose your preferred action:",
          instructions: [
            "👁️ View: See full ticket details",
            "📋 Validate: Check ticket status with bus staff", 
            "📥 Download: Save ticket for offline use",
            "📱 Always keep your phone charged during travel",
            "🆔 Carry a valid photo ID for verification"
          ],
          actions: [
            {
              type: "view",
              label: "👁️ View Full Ticket",
              url: `/booking/confirmation/${pnr}?mobile=true`,
              primary: true
            },
            {
              type: "validate",
              label: "📋 Quick Validation",
              url: `/qr-scanner?pnr=${pnr}`,
              secondary: true
            },
            {
              type: "download",
              label: "📥 Download PDF",
              url: `/booking/confirmation/${pnr}?download=1`,
              secondary: true
            }
          ]
        };
        
        console.log(`📱 Mobile QR Response for PNR ${pnr}:`, response);
        return NextResponse.json(response);
      } else {
        // Regular download action
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