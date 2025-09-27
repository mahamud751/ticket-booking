"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Bus,
  Calendar,
  DollarSign,
  Edit,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";

interface Schedule {
  id: string;
  departureTime: string;
  arrivalTime: string;
  basePrice: number;
  isActive: boolean;
  route: {
    id: string;
    origin: {
      name: string;
      code: string;
    };
    destination: {
      name: string;
      code: string;
    };
  };
  bus: {
    id: string;
    busNumber: string;
    busType: string;
  };
  operator: {
    id: string;
    name: string;
  };
  pricingTiers: Array<{
    seatType: string;
    price: number;
  }>;
  bookings: Array<{
    id: string;
    status: string;
  }>;
}

export default function AdminSchedules() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/admin/schedules?page=${page}&limit=20`
      );
      const data = await response.json();

      if (data.success) {
        setSchedules(data.data.schedules);
        setTotalPages(data.data.pagination.pages);
      } else {
        toast.error(data.error || "Failed to fetch schedules");
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast.error("Failed to fetch schedules");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== "ADMIN") {
      router.push("/auth/signin");
      return;
    }

    fetchSchedules();
  }, [session, status, router, fetchSchedules]);

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

  const getBookingStats = (bookings: Array<{ status: string }>) => {
    const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
    const pending = bookings.filter((b) => b.status === "PENDING").length;
    const total = bookings.length;

    return { confirmed, pending, total };
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading schedules...</span>
      </div>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-8">
            You don&apos;t have permission to access this page.
          </p>
          <Button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push("/admin")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Manage Schedules
                </h1>
                <p className="text-sm text-gray-600">
                  Create and manage bus schedules and pricing
                </p>
              </div>
            </div>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Schedule</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-gray-600 text-center">
                    Schedule creation form would go here.
                  </p>
                  <p className="text-sm text-gray-500 text-center mt-2">
                    This would include route selection, bus assignment, timing,
                    and pricing.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      toast.success("Schedule creation form coming soon!");
                      setShowAddDialog(false);
                    }}
                  >
                    Create Schedule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Schedules
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {schedules.length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Active Schedules
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {schedules.filter((s) => s.isActive).length}
                  </p>
                </div>
                <Bus className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Bookings
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {schedules.reduce(
                      (total, s) => total + s.bookings.length,
                      0
                    )}
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Avg. Price
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    $
                    {schedules.length > 0
                      ? (
                          schedules.reduce(
                            (total, s) => total + s.basePrice,
                            0
                          ) / schedules.length
                        ).toFixed(0)
                      : 0}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedules Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead>Bus</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Bookings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => {
                    const departure = formatDateTime(schedule.departureTime);
                    const bookingStats = getBookingStats(schedule.bookings);

                    return (
                      <TableRow key={schedule.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {schedule.route.origin.name} →{" "}
                              {schedule.route.destination.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {schedule.route.origin.code} →{" "}
                              {schedule.route.destination.code}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">
                            {schedule.operator.name}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {schedule.bus.busNumber}
                            </div>
                            <Badge variant="outline" className="text-xs mt-1">
                              {schedule.bus.busType}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium">{departure.time}</div>
                            <div className="text-sm text-gray-600">
                              {departure.date}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">
                            ${schedule.basePrice}
                          </div>
                          {schedule.pricingTiers.length > 1 && (
                            <div className="text-sm text-gray-600">
                              Premium: $
                              {schedule.pricingTiers.find(
                                (t) => t.seatType === "PREMIUM"
                              )?.price || schedule.basePrice}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {bookingStats.total}
                            </div>
                            <div className="text-sm text-gray-600">
                              {bookingStats.confirmed} confirmed,{" "}
                              {bookingStats.pending} pending
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              schedule.isActive ? "default" : "secondary"
                            }
                          >
                            {schedule.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toast("Edit feature coming soon!", {
                                  icon: "ℹ️",
                                })
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toast("Delete feature coming soon!", {
                                  icon: "ℹ️",
                                })
                              }
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
