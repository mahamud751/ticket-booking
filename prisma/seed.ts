import { PrismaClient, SeatType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create cities
  const cities = await Promise.all([
    prisma.city.upsert({
      where: { code: "DHK" },
      update: {},
      create: {
        name: "Dhaka",
        state: "Dhaka Division",
        country: "Bangladesh",
        code: "DHK",
      },
    }),
    prisma.city.upsert({
      where: { code: "CTG" },
      update: {},
      create: {
        name: "Chittagong",
        state: "Chittagong Division",
        country: "Bangladesh",
        code: "CTG",
      },
    }),
    prisma.city.upsert({
      where: { code: "SYL" },
      update: {},
      create: {
        name: "Sylhet",
        state: "Sylhet Division",
        country: "Bangladesh",
        code: "SYL",
      },
    }),
    prisma.city.upsert({
      where: { code: "RAJ" },
      update: {},
      create: {
        name: "Rajshahi",
        state: "Rajshahi Division",
        country: "Bangladesh",
        code: "RAJ",
      },
    }),
    prisma.city.upsert({
      where: { code: "KHL" },
      update: {},
      create: {
        name: "Khulna",
        state: "Khulna Division",
        country: "Bangladesh",
        code: "KHL",
      },
    }),
  ]);

  console.log("✅ Created cities");

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@busticketing.com" },
    update: {},
    create: {
      email: "admin@busticketing.com",
      name: "System Administrator",
      role: "ADMIN",
      password: hashedPassword,
      phone: "+8801234567890",
    },
  });

  console.log("✅ Created admin user");

  // Create operators
  const operators = await Promise.all([
    prisma.operator.upsert({
      where: { name: "Green Line Paribahan" },
      update: {},
      create: {
        name: "Green Line Paribahan",
        contactInfo: "+8801711111111",
      },
    }),
    prisma.operator.upsert({
      where: { name: "Hanif Enterprise" },
      update: {},
      create: {
        name: "Hanif Enterprise",
        contactInfo: "+8801722222222",
      },
    }),
    prisma.operator.upsert({
      where: { name: "Shyamoli Paribahan" },
      update: {},
      create: {
        name: "Shyamoli Paribahan",
        contactInfo: "+8801733333333",
      },
    }),
  ]);

  console.log("✅ Created operators");

  // Create buses for each operator
  const buses = [];
  for (const operator of operators) {
    for (let i = 1; i <= 3; i++) {
      const bus = await prisma.bus.create({
        data: {
          operatorId: operator.id,
          busNumber: `${operator.name.substring(0, 3).toUpperCase()}-${i
            .toString()
            .padStart(3, "0")}`,
          busType: i === 1 ? "LUXURY" : i === 2 ? "AC" : "NON_AC",
          totalSeats: 40,
          amenities:
            i === 1
              ? ["AC", "WiFi", "USB_Charging", "Restroom"]
              : i === 2
              ? ["AC", "USB_Charging"]
              : ["USB_Charging"],
        },
      });
      buses.push(bus);

      // Create seat layout for each bus
      const seatLayout = [];
      for (let row = 1; row <= 10; row++) {
        for (const col of ["A", "B", "C", "D"]) {
          seatLayout.push({
            busId: bus.id,
            seatNumber: `${row}${col}`,
            seatType: row <= 2 ? SeatType.PREMIUM : SeatType.REGULAR,
          });
        }
      }

      await prisma.seatLayout.createMany({
        data: seatLayout,
      });
    }
  }

  console.log("✅ Created buses and seat layouts");

  // Create routes
  const routes = [];
  for (let i = 0; i < cities.length; i++) {
    for (let j = 0; j < cities.length; j++) {
      if (i !== j) {
        for (const operator of operators) {
          const route = await prisma.route.create({
            data: {
              operatorId: operator.id,
              originId: cities[i].id,
              destinationId: cities[j].id,
              distance: Math.random() * 300 + 50, // Random distance between 50-350 km
              duration: Math.floor(Math.random() * 300 + 120), // Random duration between 2-7 hours
            },
          });
          routes.push(route);
        }
      }
    }
  }

  console.log("✅ Created routes");

  // Create schedules for the next 7 days
  const schedules = [];
  for (const route of routes.slice(0, 20)) {
    // Limit to first 20 routes for demo
    const routeBuses = buses.filter(
      (bus) => bus.operatorId === route.operatorId
    );

    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);

      // Create 3 schedules per day per route
      for (let scheduleIndex = 0; scheduleIndex < 3; scheduleIndex++) {
        const departureHour = 6 + scheduleIndex * 6; // 6 AM, 12 PM, 6 PM
        const departureTime = new Date(date);
        departureTime.setHours(departureHour, 0, 0, 0);

        const arrivalTime = new Date(departureTime);
        arrivalTime.setMinutes(arrivalTime.getMinutes() + route.duration);

        const bus = routeBuses[scheduleIndex % routeBuses.length];

        const schedule = await prisma.schedule.create({
          data: {
            routeId: route.id,
            busId: bus.id,
            operatorId: route.operatorId,
            departureTime,
            arrivalTime,
            basePrice: Math.floor(Math.random() * 500 + 200), // Base price between $2-$7
          },
        });

        // Create pricing tiers
        await prisma.pricingTier.createMany({
          data: [
            {
              scheduleId: schedule.id,
              seatType: SeatType.REGULAR,
              price: schedule.basePrice,
            },
            {
              scheduleId: schedule.id,
              seatType: SeatType.PREMIUM,
              price: schedule.basePrice * 1.5,
            },
          ],
        });

        schedules.push(schedule);
      }
    }
  }

  console.log("✅ Created schedules and pricing tiers");

  console.log("🎉 Database seeded successfully!");
  console.log(`
📊 Summary:
- Cities: ${cities.length}
- Operators: ${operators.length}
- Buses: ${buses.length}
- Routes: ${routes.length}
- Schedules: ${schedules.length}
- Admin User: admin@busticketing.com (password: admin123)
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
