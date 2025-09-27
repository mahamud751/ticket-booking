"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, User, MapPin, Settings } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedBus from "./AnimatedBus";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
                    <Button variant="ghost" size="sm" onClick={() => signIn()}>
                      <User className="h-4 w-4 mr-2" />
                      Sign In
                    </Button>
                    <Button size="sm" className="ml-2" onClick={() => signIn()}>
                      Sign Up
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
              <Link
                href="/"
                className="text-gray-900 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium"
              >
                Home
              </Link>
              <Link
                href="/"
                className="text-gray-900 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium"
              >
                Routes
              </Link>
              <Link
                href="/my-bookings"
                className="text-gray-900 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium"
              >
                My Bookings
              </Link>
              <Link
                href="/"
                className="text-gray-900 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium"
              >
                Support
              </Link>
              <div className="pt-4 pb-3 border-t border-gray-200">
                <div className="flex items-center px-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start mb-2"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </div>
                <div className="px-3">
                  <Button size="sm" className="w-full">
                    Sign Up
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
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
    </>
  );
}
