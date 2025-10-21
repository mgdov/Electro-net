
import type { ChargePoint } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Wifi, WifiOff } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { ConnectorsList } from "./connectors-list"
import React from "react"

interface ChargePointCardProps {
  chargePoint: ChargePoint
  onStart: (connectorId: number) => Promise<any>
  onStop: (transactionId: string) => Promise<any>
}

export const ChargePointCard = React.memo(function ChargePointCard({ chargePoint, onStart, onStop }: ChargePointCardProps) {
  const isOnline = chargePoint.status === "online"

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-semibold text-foreground">{chargePoint.name}</h3>
              <Badge
                variant={isOnline ? "default" : "secondary"}
                className={isOnline ? "bg-[var(--color-success)] text-white" : "bg-muted text-muted-foreground"}
              >
                <div className="flex items-center gap-1.5">
                  {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {isOnline ? "Online" : "Offline"}
                </div>
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {chargePoint.location}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 mb-6 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">ID:</span> {chargePoint.id}
          </div>
          <div>
            <span className="font-medium">Прошивка:</span> {chargePoint.firmwareVersion}
          </div>
          <div>
            <span className="font-medium">Обновлено:</span> {formatDate(chargePoint.lastSeen)}
          </div>
        </div>

        {/* Connectors */}
        <ConnectorsList
          connectors={chargePoint.connectors}
          chargePointId={chargePoint.id}
          onStart={onStart}
          onStop={onStop}
        />
      </div>
    </Card>
  )
})
