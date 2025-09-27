"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Calendar, Eye, Search } from "lucide-react";
import { toast } from "react-hot-toast";

interface Booking {
  id: string;
  pnr: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  passengerName: string;
  passengerPhone: string;
  passengerEmail: string;
  bookingDate: string;
  schedule: {
    departureTime: string;
    arrivalTime: string;
    route: {
      origin: {
        name: string;
        code: string;
      };
      destination: {
        name: string;
        code: string;
      };
      distance: number;
      duration: number;
    };
    bus: {
      busNumber: string;
      busType: string;
      amenities: string[];
    };
    operator: {
      name: string;
    };
  };
  seats: Array<{
    id: string;
    price: number;
    seat: {
      seatNumber: string;
      seatType: string;
    };
  }>;
  passengers?: Array<{
    id: string;
    passengerName: string;
    seat: {
      seatNumber: string;
      seatType: string;
    };
  }>;
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  useEffect(() => {
    // For demo purposes, load bookings from session storage
    // In production, this would fetch from API based on user authentication
    loadBookingsFromStorage();
  }, []);

  useEffect(() => {
    // Filter bookings based on search query
    if (searchQuery) {
      const filtered = bookings.filter((booking) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          (booking.pnr && booking.pnr.toLowerCase().includes(searchLower)) ||
          (booking.schedule?.route?.origin?.name &&
            booking.schedule.route.origin.name
              .toLowerCase()
              .includes(searchLower)) ||
          (booking.schedule?.route?.destination?.name &&
            booking.schedule.route.destination.name
              .toLowerCase()
              .includes(searchLower)) ||
          (booking.passengerName &&
            booking.passengerName.toLowerCase().includes(searchLower))
        );
      });
      setFilteredBookings(filtered);
    } else {
      setFilteredBookings(bookings);
    }
  }, [searchQuery, bookings]);

  const loadBookingsFromStorage = () => {
    try {
      const allBookings: Booking[] = [];

      // Load all booking confirmations from session storage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("booking_confirmed_")) {
          const bookingData = sessionStorage.getItem(key);
          if (bookingData) {
            const booking = JSON.parse(bookingData);
            allBookings.push(booking);
          }
        }
      }

      // Sort bookings by booking date (newest first)
      allBookings.sort(
        (a, b) =>
          new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
      );

      setBookings(allBookings);
      setFilteredBookings(allBookings);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  const searchBookingByEmail = async () => {
    if (!searchEmail || !searchQuery) {
      toast.error("Please enter both PNR and email address");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/bookings?pnr=${encodeURIComponent(
          searchQuery
        )}&email=${encodeURIComponent(searchEmail)}`
      );
      const data = await response.json();

      if (data.success) {
        const booking = data.data.booking;
        // Add to bookings if not already present
        const existingBooking = bookings.find((b) => b.pnr === booking.pnr);
        if (!existingBooking) {
          const updatedBookings = [booking, ...bookings];
          setBookings(updatedBookings);
          setFilteredBookings(updatedBookings);

          // Store in session storage for future access
          sessionStorage.setItem(
            `booking_confirmed_${booking.pnr}`,
            JSON.stringify(booking)
          );
        }
        toast.success("Booking found and added to your list!");
        setSearchQuery("");
        setSearchEmail("");
      } else {
        toast.error(data.error || "Booking not found");
      }
    } catch (error) {
      console.error("Error searching booking:", error);
      toast.error("Failed to search booking");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-800 border-green-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      case "UNKNOWN":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const viewBookingDetails = (pnr: string) => {
    router.push(`/booking/confirmation/${pnr}`);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading bookings...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h1>
          <p className="text-gray-600">
            Manage and view all your bus ticket bookings
          </p>
        </div>

        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Search Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search by PNR, Route, or Name</Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Enter PNR, origin, destination, or passenger name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">Email (for API search)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email to search from server"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={searchBookingByEmail}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!searchQuery || !searchEmail}
                >
                  Search from Server
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">🎫</div>
              <h3 className="text-lg font-semibold mb-2">No Bookings Found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery
                  ? "No bookings match your search criteria."
                  : "You haven't made any bookings yet."}
              </p>
              <Button
                onClick={() => router.push("/")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Book Your First Trip
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredBookings.map((booking, index) => {
              // Add safety checks for date formatting
              const departure = booking.schedule?.departureTime
                ? formatDateTime(booking.schedule.departureTime)
                : { date: "Unknown", time: "Unknown" };
              const bookingDate = booking.bookingDate
                ? formatDateTime(booking.bookingDate)
                : { date: "Unknown", time: "Unknown" };

              // Create a unique key using multiple fallback identifiers
              const uniqueKey =
                booking.pnr ||
                booking.id ||
                `${booking.schedule.departureTime}-${booking.totalAmount}-${index}`;

              return (
                <Card
                  key={`booking-${uniqueKey}-${index}`}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Journey Info */}
                      <div className="lg:col-span-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-lg">
                            {booking.schedule?.route?.origin?.name || "Unknown"}{" "}
                            →{" "}
                            {booking.schedule?.route?.destination?.name ||
                              "Unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {departure.date} at {departure.time}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {booking.schedule?.operator?.name ||
                            "Unknown Operator"}{" "}
                          • {booking.schedule?.bus?.busNumber || "Unknown Bus"}
                        </div>
                      </div>

                      {/* Booking Details */}
                      <div className="lg:col-span-3">
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-gray-600">PNR:</span>
                            <div className="font-semibold">
                              {booking.pnr || "N/A"}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">
                              {booking.passengers &&
                              booking.passengers.length > 0
                                ? "Passengers:"
                                : "Passenger:"}
                            </span>
                            <div className="font-medium">
                              {booking.passengers &&
                              booking.passengers.length > 0 ? (
                                <div className="space-y-1">
                                  {booking.passengers.map(
                                    (passenger, passengerIndex) => (
                                      <div
                                        key={`${uniqueKey}-passenger-${
                                          passenger.id || passengerIndex
                                        }`}
                                        className="text-sm"
                                      >
                                        {passenger.passengerName} (Seat{" "}
                                        {passenger.seat.seatNumber})
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : (
                                booking.passengerName || "Unknown Passenger"
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">
                              Seats:
                            </span>
                            <div className="font-medium">
                              {(booking.seats || [])
                                .map((s) => s.seat?.seatNumber || "N/A")
                                .join(", ")}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status & Amount */}
                      <div className="lg:col-span-3">
                        <div className="space-y-2">
                          <div>
                            <Badge
                              className={getStatusColor(
                                booking.status || "UNKNOWN"
                              )}
                            >
                              {booking.status || "Unknown"}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">
                              Amount:
                            </span>
                            <div className="text-lg font-bold text-green-600">
                              ${booking.totalAmount || 0}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            Booked on {bookingDate.date}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="lg:col-span-2">
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() =>
                              viewBookingDetails(booking.pnr || uniqueKey)
                            }
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            size="sm"
                            disabled={!booking.pnr}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
