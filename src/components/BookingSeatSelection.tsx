"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock,
  User,
  X,
  CheckCircle,
  MapPin,
  Calendar,
  Users,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { formatDistance } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";

interface Seat {
  id: string;
  seatNumber: string;
  seatType: "REGULAR" | "PREMIUM" | "SLEEPER";
  price: number;
  status: "available" | "booked" | "locked" | "unavailable";
  isSelectable: boolean;
  lockInfo?: {
    expiresAt: string;
    sessionId: string;
  };
}

interface Schedule {
  id: string;
  departureTime: string;
  arrivalTime: string;
  basePrice: number;
  route: {
    origin: { name: string; code: string };
    destination: { name: string; code: string };
    duration: number;
    distance: number;
  };
  operator: { name: string };
  bus: {
    busNumber: string;
    busType: string;
    totalSeats: number;
    amenities: string[];
  };
}

interface SeatSelectionProps {
  scheduleId: string;
  passengers: number;
  sessionId: string;
  onBookingComplete: (bookingData: { booking: { id: string } }) => void;
}

export default function BookingSeatSelection({
  scheduleId,
  passengers,
  sessionId,
  onBookingComplete,
}: SeatSelectionProps) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatMap, setSeatMap] = useState<{ [key: string]: Seat[] }>({});
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [lockTimeRemaining, setLockTimeRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocking, setIsLocking] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // Socket.io connection
  const { emit, on, off } = useSocket(scheduleId);

  // Contact info (shared for all passengers)
  const [contactInfo, setContactInfo] = useState({
    phone: "",
    email: "",
  });

  // Individual passenger names for each seat
  const [passengerNames, setPassengerNames] = useState<{
    [seatId: string]: string;
  }>({});

  // Fetch seat map data
  const fetchSeatMap = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/schedules/${scheduleId}/seats`);
      const data = await response.json();

      if (data.success) {
        setSchedule(data.data.schedule);
        setSeats(data.data.seats);
        setSeatMap(data.data.seatMap);
      } else {
        toast.error(data.error || "Failed to load seat map");
      }
    } catch (error) {
      console.error("Error fetching seat map:", error);
      toast.error("Failed to load seat map");
    } finally {
      setIsLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    if (scheduleId) {
      fetchSeatMap();
    }
  }, [scheduleId, fetchSeatMap]);

  // Lock timer countdown
  useEffect(() => {
    if (lockTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time expired - clear selection
          setSelectedSeats([]);
          toast.error("Seat locks expired. Please select seats again.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockTimeRemaining]);

  // Socket.io event listeners
  useEffect(() => {
    // Listen for real-time seat lock events
    on("seats-being-locked", (data) => {
      if (data.sessionId !== sessionId) {
        // Visual feedback - just refresh seat map
        fetchSeatMap();
      }
    });

    on("seats-locked", (data) => {
      if (data.sessionId !== sessionId) {
        // Refresh seat map to show new locks
        fetchSeatMap();
      }
    });

    on("seats-unlocked", (data) => {
      if (data.sessionId !== sessionId) {
        fetchSeatMap();
      }
    });

    on("seats-booked", (data) => {
      // Refresh seat map when someone completes booking
      fetchSeatMap();
      toast(
        `${data.seatIds.length} seat${
          data.seatIds.length !== 1 ? "s" : ""
        } just got booked!`
      );
    });

    return () => {
      off("seats-being-locked");
      off("seats-locked");
      off("seats-unlocked");
      off("seats-booked");
    };
  }, [on, off, sessionId, fetchSeatMap]);

  const handleSeatClick = async (seatId: string) => {
    const seat = seats.find((s) => s.id === seatId);
    if (!seat || !seat.isSelectable) return;

    // Prevent clicking during loading
    if (isLocking) {
      return;
    }

    if (selectedSeats.includes(seatId)) {
      // Deselect seat and remove from lock
      const newSelection = selectedSeats.filter((id) => id !== seatId);
      setSelectedSeats(newSelection);

      // Remove passenger name for this seat
      setPassengerNames((prev) => {
        const updated = { ...prev };
        delete updated[seatId];
        return updated;
      });

      // Emit real-time unlock event
      emit("seat-deselected", {
        scheduleId,
        seatId,
        sessionId,
      });

      // Update locks for remaining seats or release all if none selected
      if (newSelection.length > 0) {
        await lockSeats(newSelection);
      } else {
        // Release all locks if no seats selected
        await releaseSeats();
        setLockTimeRemaining(0);
      }
    } else if (selectedSeats.length < passengers) {
      // Select seat - add to current selection and lock all selected seats
      const newSelection = [...selectedSeats, seatId];

      // Always release previous locks first, then lock the new selection
      await releaseSeats();
      await lockSeats(newSelection);
    } else {
      toast.error(
        `You can only select ${passengers} seat${
          passengers !== 1 ? "s" : ""
        }. Maximum 4 seats per booking.`
      );
    }
  };

  const lockSeats = async (seatIds: string[]) => {
    try {
      setIsLocking(true);

      // Emit socket event for real-time updates
      const firstPassengerName =
        Object.values(passengerNames)[0] || "Anonymous";
      emit("seat-lock-attempt", {
        scheduleId,
        seatIds,
        sessionId,
        userName: firstPassengerName,
      });

      const response = await fetch("/api/seats/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          seatIds,
          sessionId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSelectedSeats(seatIds);
        setLockTimeRemaining(5 * 60); // 5 minutes
        toast.success(
          `${seatIds.length} seat${
            seatIds.length !== 1 ? "s" : ""
          } locked successfully! You have 5 minutes to complete booking.`
        );

        // Emit success event
        emit("seat-lock-success", {
          scheduleId,
          seatIds,
          sessionId,
          expiresAt: data.data.expiresAt,
        });

        // Refresh seat map to show updated locks
        await fetchSeatMap();
      } else {
        toast.error(data.error || "Failed to lock seats");
        // Reset selection on failure
        setSelectedSeats([]);

        // If it's a specific seat availability error, refresh the seat map
        if (data.error && data.error.includes("no longer available")) {
          await fetchSeatMap();
        }
      }
    } catch (error) {
      console.error("Error locking seats:", error);
      toast.error("Failed to lock seats. Please try again.");
      setSelectedSeats([]);
    } finally {
      setIsLocking(false);
    }
  };

  const releaseSeats = async () => {
    try {
      await fetch(`/api/seats/lock?sessionId=${sessionId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Error releasing seats:", error);
    }
  };

  const handleBooking = async () => {
    if (selectedSeats.length !== passengers) {
      toast.error(
        `Please select exactly ${passengers} seat${passengers !== 1 ? "s" : ""}`
      );
      return;
    }

    // Validate all passenger information
    const missingNames = selectedSeats.filter(
      (seatId) => !passengerNames[seatId]?.trim()
    );

    if (missingNames.length > 0) {
      toast.error("Please enter names for all passengers");
      return;
    }

    if (!contactInfo.phone?.trim() || !contactInfo.email?.trim()) {
      toast.error("Please enter contact phone and email");
      return;
    }

    try {
      setIsBooking(true);

      // Use the first passenger name for the main booking record
      // and pass all passenger names in the request
      const passengerInfo = {
        name: passengerNames[selectedSeats[0]] || "Primary Passenger",
        phone: contactInfo.phone,
        email: contactInfo.email,
      };

      const passengersData = selectedSeats.map((seatId) => ({
        name: passengerNames[seatId],
        phone: contactInfo.phone,
        email: contactInfo.email,
        seatId,
      }));

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          seatIds: selectedSeats,
          passengerInfo,
          passengersData,
          sessionId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Booking created successfully!");

        // Store booking data for payment page
        sessionStorage.setItem(
          `booking_${data.data.booking.id}`,
          JSON.stringify(data.data)
        );

        onBookingComplete(data.data);
      } else {
        toast.error(data.error || "Failed to create booking");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error("Failed to create booking");
    } finally {
      setIsBooking(false);
    }
  };

  const getSeatClassName = (seat: Seat) => {
    const baseClasses =
      "w-10 h-10 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center text-xs font-medium relative";

    if (seat.status === "booked") {
      return `${baseClasses} bg-red-100 border-red-300 cursor-not-allowed text-red-700`;
    }

    if (seat.status === "locked" && !selectedSeats.includes(seat.id)) {
      return `${baseClasses} bg-yellow-100 border-yellow-300 cursor-not-allowed text-yellow-700`;
    }

    if (selectedSeats.includes(seat.id)) {
      return `${baseClasses} bg-blue-500 border-blue-600 text-white shadow-lg transform scale-105`;
    }

    if (seat.seatType === "PREMIUM") {
      return `${baseClasses} bg-purple-50 border-purple-300 hover:bg-purple-100 text-purple-700 hover:border-purple-400`;
    }

    if (seat.seatType === "SLEEPER") {
      return `${baseClasses} bg-indigo-50 border-indigo-300 hover:bg-indigo-100 text-indigo-700 hover:border-indigo-400`;
    }

    return `${baseClasses} bg-green-50 border-green-300 hover:bg-green-100 text-green-700 hover:border-green-400`;
  };

  const totalAmount = selectedSeats.reduce((total, seatId) => {
    const seat = seats.find((s) => s.id === seatId);
    return total + (seat?.price || 0);
  }, 0);

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes / 60);
    const secs = minutes % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading seat map...</span>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Schedule not found</p>
      </div>
    );
  }

  const departure = formatDateTime(schedule.departureTime);

  return (
    <div className="space-y-6">
      {/* Schedule Info */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-1" />
                Route
              </div>
              <div className="text-lg font-semibold">
                {schedule.route.origin.name} → {schedule.route.destination.name}
              </div>
              <div className="text-sm text-gray-600">
                {formatDistance(schedule.route.distance || 0)} km •{" "}
                {Math.floor((schedule.route.duration || 0) / 60)}h{" "}
                {(schedule.route.duration || 0) % 60}m
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-1" />
                Departure
              </div>
              <div className="text-lg font-semibold">{departure.time}</div>
              <div className="text-sm text-gray-600">{departure.date}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <Users className="h-4 w-4 mr-1" />
                Bus Details
              </div>
              <div className="text-lg font-semibold">
                {schedule.operator.name}
              </div>
              <div className="text-sm text-gray-600">
                {schedule.bus.busNumber} • {schedule.bus.busType}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seat Map */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Select Your Seats</CardTitle>
              {lockTimeRemaining > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-600 font-medium">
                    {formatTime(lockTimeRemaining)}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Driver area */}
              <div className="flex justify-center">
                <div className="bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium">
                  🚗 Driver
                </div>
              </div>

              {/* Seat grid */}
              <div className="space-y-4">
                {Object.entries(seatMap).map(([row, rowSeats]) => (
                  <div key={row} className="flex items-center gap-2">
                    <div className="w-6 text-center text-sm font-medium text-gray-600">
                      {row}
                    </div>
                    <div className="flex gap-2">
                      {rowSeats.slice(0, 2).map((seat) => (
                        <div
                          key={seat.id}
                          className={getSeatClassName(seat)}
                          onClick={() => handleSeatClick(seat.id)}
                          title={`Seat ${seat.seatNumber} - ${seat.seatType} ($${seat.price})`}
                        >
                          {seat.seatNumber.slice(-1)}
                          {selectedSeats.includes(seat.id) && (
                            <CheckCircle className="absolute -top-1 -right-1 h-4 w-4 text-blue-600 bg-white rounded-full" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="w-8"></div> {/* Aisle */}
                    <div className="flex gap-2">
                      {rowSeats.slice(2).map((seat) => (
                        <div
                          key={seat.id}
                          className={getSeatClassName(seat)}
                          onClick={() => handleSeatClick(seat.id)}
                          title={`Seat ${seat.seatNumber} - ${seat.seatType} ($${seat.price})`}
                        >
                          {seat.seatNumber.slice(-1)}
                          {selectedSeats.includes(seat.id) && (
                            <CheckCircle className="absolute -top-1 -right-1 h-4 w-4 text-blue-600 bg-white rounded-full" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 justify-center text-xs border-t pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-50 border-2 border-purple-300 rounded"></div>
                  <span>Premium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 border-2 border-blue-600 rounded"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
                  <span>Locked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                  <span>Booked</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Booking Summary */}
        <div className="space-y-6">
          {/* Selected Seats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Selected Seats ({selectedSeats.length}/{passengers})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedSeats.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  No seats selected
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedSeats.map((seatId) => {
                    const seat = seats.find((s) => s.id === seatId);
                    if (!seat) return null;

                    return (
                      <div
                        key={seatId}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">
                            Seat {seat.seatNumber || "N/A"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {seat.seatType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${seat.price}</span>
                          <button
                            onClick={() => handleSeatClick(seatId)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {selectedSeats.length > 0 && (
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-blue-600">${totalAmount}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Passenger Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Passenger Information</CardTitle>
              <p className="text-sm text-gray-600">
                Enter individual names and shared contact details
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedSeats.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  Select seats to enter passenger information
                </p>
              ) : (
                <>
                  {/* Individual Passenger Names */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      Passenger Names
                    </h3>
                    {selectedSeats.map((seatId, index) => {
                      const seat = seats.find((s) => s.id === seatId);
                      const seatNumber = seat?.seatNumber || "N/A";

                      return (
                        <div
                          key={seatId}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <div className="flex-shrink-0">
                              <span className="font-medium text-sm">
                                Seat {seatNumber}:
                              </span>
                            </div>
                            <Input
                              value={passengerNames[seatId] || ""}
                              onChange={(e) =>
                                setPassengerNames((prev) => ({
                                  ...prev,
                                  [seatId]: e.target.value,
                                }))
                              }
                              placeholder={`Passenger ${index + 1} full name`}
                              className="flex-1"
                              required
                            />
                          </div>
                          <Badge
                            variant="outline"
                            className="text-xs flex-shrink-0"
                          >
                            {seat?.seatType}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>

                  {/* Shared Contact Information */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-gray-900">
                      Contact Information
                    </h3>
                    <p className="text-sm text-gray-600">
                      This will be used for all passengers
                    </p>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="contact-phone">Phone Number *</Label>
                        <Input
                          id="contact-phone"
                          value={contactInfo.phone}
                          onChange={(e) =>
                            setContactInfo((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="Enter phone number"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="contact-email">Email Address *</Label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={contactInfo.email}
                          onChange={(e) =>
                            setContactInfo((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="Enter email address"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Proceed Button */}
          <Button
            onClick={handleBooking}
            disabled={
              selectedSeats.length !== passengers ||
              selectedSeats.some((seatId) => !passengerNames[seatId]?.trim()) ||
              !contactInfo.phone?.trim() ||
              !contactInfo.email?.trim() ||
              isBooking ||
              isLocking
            }
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-semibold"
          >
            {isBooking ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating Booking...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                Proceed to Payment (${totalAmount})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
