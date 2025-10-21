"use client"

import type { ChargePoint } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Activity, Zap, AlertCircle, CheckCircle } from "lucide-react"
import { useMemo } from "react"
import React from "react"

interface DashboardStatsProps {
  chargePoints: ChargePoint[]
}

const numberFmt = new Intl.NumberFormat('ru-RU')

export const DashboardStats = React.memo(function DashboardStats({ chargePoints }: DashboardStatsProps) {
  const stats = useMemo(() => {
    const totalConnectors = chargePoints.reduce((sum, cp) => sum + cp.connectors.length, 0)
    const availableConnectors = chargePoints.reduce(
      (sum, cp) => sum + cp.connectors.filter((c) => c.status === "Available").length,
      0,
    )
    const occupiedConnectors = chargePoints.reduce(
      (sum, cp) => sum + cp.connectors.filter((c) => c.status === "Occupied").length,
      0,
    )
    const faultedConnectors = chargePoints.reduce(
      (sum, cp) => sum + cp.connectors.filter((c) => c.status === "Faulted").length,
      0,
    )

    return {
      totalConnectors,
      availableConnectors,
      occupiedConnectors,
      faultedConnectors,
    }
  }, [chargePoints])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card className="bg-card border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Activity className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Всего коннекторов</div>
            <div className="text-2xl font-bold text-foreground">{numberFmt.format(stats.totalConnectors)}</div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-success)]/20">
            <CheckCircle className="h-5 w-5 text-[var(--color-success)]" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Доступно</div>
            <div className="text-2xl font-bold text-foreground">{numberFmt.format(stats.availableConnectors)}</div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-occupied)]/20">
            <Zap className="h-5 w-5 text-[var(--color-occupied)]" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Занято</div>
            <div className="text-2xl font-bold text-foreground">{numberFmt.format(stats.occupiedConnectors)}</div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-error)]/20">
            <AlertCircle className="h-5 w-5 text-[var(--color-error)]" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Ошибки</div>
            <div className="text-2xl font-bold text-foreground">{numberFmt.format(stats.faultedConnectors)}</div>
          </div>
        </div>
      </Card>
    </div>
  )
})
