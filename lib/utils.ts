import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ConnectorStatus } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow", // Explicit timezone for consistency
  }).format(new Date(date))
}

export function formatDuration(startTime: string, endTime?: string | null): string {
  const start = new Date(startTime).getTime()
  // For active transactions without endTime, return placeholder or calculate on client only
  if (!endTime) {
    return "В процессе..."
  }
  const end = new Date(endTime).getTime()
  const duration = end - start

  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}ч ${minutes}м`
  }
  return `${minutes}м`
}

export function formatEnergy(kWh: number): string {
  return `${kWh.toFixed(2)} кВт⋅ч`
}

export function formatPower(kW: number): string {
  return `${kW.toFixed(1)} кВт`
}

export function getConnectorStatusColor(status: ConnectorStatus): string {
  switch (status) {
    case "Available":
      return "text-[var(--color-available)]"
    case "Occupied":
      return "text-[var(--color-occupied)]"
    case "Faulted":
      return "text-[var(--color-faulted)]"
    case "Unavailable":
      return "text-[var(--color-unavailable)]"
    case "Reserved":
      return "text-[var(--color-reserved)]"
    default:
      return "text-muted-foreground"
  }
}

export function getConnectorStatusBgColor(status: ConnectorStatus): string {
  switch (status) {
    case "Available":
      return "bg-[var(--color-available)]"
    case "Occupied":
      return "bg-[var(--color-occupied)]"
    case "Faulted":
      return "bg-[var(--color-faulted)]"
    case "Unavailable":
      return "bg-[var(--color-unavailable)]"
    case "Reserved":
      return "bg-[var(--color-reserved)]"
    default:
      return "bg-muted"
  }
}

export function getConnectorStatusLabel(status: ConnectorStatus): string {
  const labels: Record<ConnectorStatus, string> = {
    Available: "Доступен",
    Occupied: "Занят",
    Faulted: "Ошибка",
    Unavailable: "Недоступен",
    Reserved: "Зарезервирован",
  }
  return labels[status]
}
