// Test script to create a sample booking for QR scanner testing
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestBooking() {
  try {
    // Create a test booking with PNR "TEST123" for QR scanner testing
    const testBooking = await prisma.booking.create({
      data: {
        pnr: "TEST123",
        userId: "test-user",
        scheduleId: "test-schedule-1", // You'll need to create this schedule first
        passengerName: "John Doe",
        passengerPhone: "+1234567890",
        passengerEmail: "john.doe@example.com",
        totalAmount: 50.00,
        paymentIntentId: "test-payment-intent",
        status: "CONFIRMED",
        paymentStatus: "COMPLETED",
      }
    });

    console.log("Test booking created:", testBooking);
    
    // Also create test seat and passenger data
    await prisma.bookingSeat.create({
      data: {
        bookingId: testBooking.id,
        seatLayoutId: "test-seat-1",
        price: 50.00,
      }
    });

    await prisma.bookingPassenger.create({
      data: {
        bookingId: testBooking.id,
        seatLayoutId: "test-seat-1",
        passengerName: "John Doe",
      }
    });

    console.log("Test booking setup complete. Use PNR: TEST123 to test QR scanner");
    
  } catch (error) {
    console.error("Error creating test booking:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestBooking();