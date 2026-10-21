"use client";

import { useSyncExternalStore } from "react";

let busy = false;
let managementBusy = false;
const listeners = new Set<() => void>();
export const isAuctionBusy = () => busy || managementBusy;
export const isAuctionManagementBusy = () => managementBusy;
export function setAuctionBusy(value: boolean) {
  if (busy === value) return;
  busy = value;
  listeners.forEach((listener) => listener());
}
export function setAuctionManagementBusy(value: boolean) {
  if (managementBusy === value) return;
  managementBusy = value;
  listeners.forEach((listener) => listener());
}
export function useAuctionManagementBusy() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isAuctionManagementBusy,
    () => false,
  );
}
export function useAuctionBusy() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isAuctionBusy,
    () => false,
  );
}
