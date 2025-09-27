"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  MapPin,
  BarChart3,
  PlusCircle,
  Clock,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface AnalyticsData {
  overview: {
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
    conversionRate: number;
  };
  topRoutes: Array<{
    scheduleId: string;
    bookings: number;
    revenue: number;
    route: {
      origin: string;
      destination: string;
      operator: string;
      departureTime: string;
    } | null;
  }>;
  operatorStats: Array<{
    operatorId: string;
    operatorName: string;
    bookings: number;
    revenue: number;
  }>;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("today");

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/analytics?period=${period}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      } else {
        toast.error(data.error || "Failed to fetch analytics");
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to fetch analytics data");
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== "ADMIN") {
      router.push("/auth/signin");
      return;
    }

    fetchAnalytics();
  }, [session, status, router, period, fetchAnalytics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Welcome back, {session.user.name}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>

              <Button
                onClick={() => router.push("/admin/schedules")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {analytics ? (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Bookings
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {analytics.overview.totalBookings}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Revenue
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCurrency(analytics.overview.totalRevenue)}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Conversion Rate
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {analytics.overview.conversionRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Pending Bookings
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {analytics.overview.pendingBookings}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/admin/schedules")}
                    className="h-20 flex flex-col items-center justify-center"
                  >
                    <Calendar className="h-6 w-6 mb-2" />
                    Manage Schedules
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => router.push("/admin/routes")}
                    className="h-20 flex flex-col items-center justify-center"
                  >
                    <MapPin className="h-6 w-6 mb-2" />
                    Manage Routes
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => router.push("/admin/analytics")}
                    className="h-20 flex flex-col items-center justify-center"
                  >
                    <BarChart3 className="h-6 w-6 mb-2" />
                    View Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Routes */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Routes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.topRoutes.slice(0, 5).map((route, index) => (
                      <div
                        key={route.scheduleId}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                            {index + 1}
                          </div>
                          <div>
                            {route.route ? (
                              <>
                                <div className="font-medium">
                                  {route.route.origin} →{" "}
                                  {route.route.destination}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {route.route.operator} •{" "}
                                  {formatDate(route.route.departureTime)}
                                </div>
                              </>
                            ) : (
                              <div className="font-medium">Unknown Route</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {route.bookings} bookings
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(route.revenue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Operator Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Operator Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.operatorStats
                      .slice(0, 5)
                      .map((operator, index) => (
                        <div
                          key={operator.operatorId}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">
                                {operator.operatorName}
                              </div>
                              <div className="text-sm text-gray-600">
                                {operator.bookings} bookings
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              {formatCurrency(operator.revenue)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Booking Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analytics.overview.confirmedBookings}
                    </div>
                    <div className="text-sm text-gray-600">Confirmed</div>
                    <Badge variant="default" className="mt-2">
                      {analytics.overview.totalBookings > 0
                        ? (
                            (analytics.overview.confirmedBookings /
                              analytics.overview.totalBookings) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </Badge>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {analytics.overview.pendingBookings}
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                    <Badge variant="secondary" className="mt-2">
                      {analytics.overview.totalBookings > 0
                        ? (
                            (analytics.overview.pendingBookings /
                              analytics.overview.totalBookings) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </Badge>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {analytics.overview.cancelledBookings}
                    </div>
                    <div className="text-sm text-gray-600">Cancelled</div>
                    <Badge variant="destructive" className="mt-2">
                      {analytics.overview.totalBookings > 0
                        ? (
                            (analytics.overview.cancelledBookings /
                              analytics.overview.totalBookings) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">No analytics data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
