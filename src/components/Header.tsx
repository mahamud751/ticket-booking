"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, User, MapPin, Settings, Home, Calendar, Search, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedBus from "./AnimatedBus";
import React from "react";

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();

  return (
    <>
      <header className="bg-white shadow-lg border-b relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0 flex items-center">
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <MapPin className="h-8 w-8 text-blue-600" />
                </motion.div>
                <motion.span
                  className="ml-2 text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                  whileHover={{ scale: 1.05 }}
                >
                  BusTicket
                </motion.span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  href="/"
                  className="text-gray-900 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="/"
                  className="text-gray-900 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Routes
                </Link>
                <Link
                  href="/my-bookings"
                  className="text-gray-900 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  My Bookings
                </Link>
                <Link
                  href="/"
                  className="text-gray-900 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Support
                </Link>
              </div>
            </div>

            {/* User Actions */}
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                {status === "loading" ? (
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                ) : session ? (
                  <div className="flex items-center space-x-4">
                    {session.user.role === "ADMIN" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/admin")}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Admin
                      </Button>
                    )}
                    <span className="text-sm text-gray-700">
                      Hello, {session.user.name?.split(" ")[0]}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => signOut()}>
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => router.push("/auth/signin")}>
                      <User className="h-4 w-4 mr-2" />
                      Sign In
                    </Button>
                    <Button size="sm" className="ml-2" onClick={() => router.push("/auth/signup")}>
                      Sign Up
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile menu button - REMOVED */}
          </div>
        </div>

        {/* Mobile Navigation - REMOVED */}
      </header>

      {/* Animated Bus Section */}
      <motion.div
        className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`cloud-${i}`}
              className="absolute bg-white opacity-20 rounded-full"
              style={{
                width: Math.random() * 60 + 20,
                height: Math.random() * 20 + 10,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                x: [0, 30, 0],
                opacity: [0.1, 0.3, 0.1],
              }}
              transition={{
                duration: 4 + Math.random() * 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
        <AnimatedBus />
      </motion.div>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </>
  );
}

// Mobile Bottom Navigation Component
function MobileBottomNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("home");

  // Update active tab based on current route
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/') setActiveTab('home');
      else if (path === '/search') setActiveTab('search');
      else if (path === '/my-bookings') setActiveTab('bookings');
      else if (path.includes('/auth')) setActiveTab('profile');
    }
  }, []);

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      href: "/",
    },
    {
      id: "search",
      label: "Search",
      icon: Search,
      href: "/search",
    },
    {
      id: "bookings",
      label: "Bookings",
      icon: Calendar,
      href: "/my-bookings",
    },
    {
      id: "support",
      label: "Support",
      icon: MessageCircle,
      href: "tel:+8801789999751",
    },
    {
      id: "profile",
      label: "Bookings",
      icon: User,
      href: "/my-bookings",
    },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    setActiveTab(item.id);
    if (item.id === "support") {
      // For support, make a phone call
      window.location.href = "tel:+8801789999751";
    } else {
      router.push(item.href);
    }
  };

  return (
    <motion.nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <motion.button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg min-w-0 flex-1 touch-manipulation ${
                isActive 
                  ? "text-blue-600 bg-blue-50" 
                  : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"
              }`}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.1 }}
            >
              <Icon className={`h-5 w-5 mb-1 ${
                isActive ? "text-blue-600" : "text-gray-600"
              }`} />
              <span className={`text-xs font-medium truncate ${
                isActive ? "text-blue-600" : "text-gray-600"
              }`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
