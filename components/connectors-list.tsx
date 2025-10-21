"use client"

import type { Connector } from "@/lib/types"
import { ConnectorRow } from "./connector-row"

interface ConnectorsListProps {
  connectors: Connector[]
  chargePointId: string
  onStart: (connectorId: number) => Promise<any>
  onStop: (transactionId: string) => Promise<any>
}

export function ConnectorsList({ connectors, chargePointId, onStart, onStop }: ConnectorsListProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground mb-3">Коннекторы</h4>
      {connectors.map((connector) => (
        <ConnectorRow
          key={connector.id}
          connector={connector}
          chargePointId={chargePointId}
          onStart={onStart}
          onStop={onStop}
        />
      ))}
    </div>
  )
}
