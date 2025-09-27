import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const scheduleCreateSchema = z.object({
  routeId: z.string().min(1),
  busId: z.string().min(1),
  departureTime: z.string().min(1),
  arrivalTime: z.string().min(1),
  basePrice: z.number().min(0),
  isActive: z.boolean().default(true),
});

// GET /api/admin/schedules - List all schedules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const routeId = searchParams.get("routeId");
    const operatorId = searchParams.get("operatorId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (routeId) where.routeId = routeId;
    if (operatorId) where.operatorId = operatorId;
    if (status) where.isActive = status === "active";

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: {
          route: {
            include: {
              origin: true,
              destination: true,
            },
          },
          bus: true,
          operator: true,
          pricingTiers: true,
          bookings: {
            select: {
              id: true,
              status: true,
              seats: true,
            },
          },
        },
        orderBy: {
          departureTime: "asc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.schedule.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        schedules,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Admin schedules GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/schedules - Create new schedule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = scheduleCreateSchema.parse(body);

    // Verify route and bus exist
    const route = await prisma.route.findUnique({
      where: { id: validatedData.routeId },
    });

    const bus = await prisma.bus.findUnique({
      where: { id: validatedData.busId },
    });

    if (!route || !bus) {
      return NextResponse.json(
        { success: false, error: "Route or bus not found" },
        { status: 404 }
      );
    }

    // Create schedule
    const schedule = await prisma.schedule.create({
      data: {
        ...validatedData,
        operatorId: route.operatorId,
        departureTime: new Date(validatedData.departureTime),
        arrivalTime: new Date(validatedData.arrivalTime),
      },
      include: {
        route: {
          include: {
            origin: true,
            destination: true,
          },
        },
        bus: true,
        operator: true,
      },
    });

    // Create default pricing tiers
    await prisma.pricingTier.createMany({
      data: [
        {
          scheduleId: schedule.id,
          seatType: "REGULAR",
          price: validatedData.basePrice,
        },
        {
          scheduleId: schedule.id,
          seatType: "PREMIUM",
          price: validatedData.basePrice * 1.5,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error("Admin schedules POST error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
