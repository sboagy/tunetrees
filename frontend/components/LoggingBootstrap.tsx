"use client";
import {
  attachLoggingController,
  isExtendedLoggingEnabled,
} from "@/lib/logging";
import { useEffect } from "react";

// Small client bootstrap to attach window.__TT_LOGGING__ controller early.
export default function LoggingBootstrap() {
  useEffect(() => {
    attachLoggingController();
    if (isExtendedLoggingEnabled()) {
      console.info("[TT_LOGGING] Extended logging ENABLED");
    }
  }, []);
  return null;
}
