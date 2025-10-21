"use client"

import type { ChargePoint } from "@/lib/types"
import { ChargePointCard } from "./charge-point-card"
import React from "react"

interface ChargePointsGridProps {
  chargePoints: ChargePoint[]
  onStart: (chargePointId: string, connectorId: number) => Promise<any>
  onStop: (chargePointId: string, transactionId: string) => Promise<any>
}

export const ChargePointsGrid = React.memo(function ChargePointsGrid({ chargePoints, onStart, onStop }: ChargePointsGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {chargePoints.map((chargePoint) => (
        <ChargePointCard
          key={chargePoint.id}
          chargePoint={chargePoint}
          onStart={(connectorId) => onStart(chargePoint.id, connectorId)}
          onStop={(transactionId) => onStop(chargePoint.id, transactionId)}
        />
      ))}
    </div>
  )
})
