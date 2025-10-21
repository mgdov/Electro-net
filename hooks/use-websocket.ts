"use client"

import { useEffect, useRef, useCallback } from "react"
import { getMockWebSocket } from "@/lib/mock-websocket"
import type {
  WebSocketEvent,
  RemoteStartTransactionPayload,
  RemoteStopTransactionPayload,
  OcppCommandResponse,
} from "@/lib/types"

export function useWebSocket() {
  const wsRef = useRef(getMockWebSocket())

  useEffect(() => {
    const ws = wsRef.current
    ws.connect()

    return () => {
      ws.disconnect()
    }
  }, [])

  const subscribe = useCallback((event: string, callback: (event: WebSocketEvent) => void) => {
    const ws = wsRef.current
    ws.on(event, callback)

    return () => {
      ws.off(event, callback)
    }
  }, [])

  const sendRemoteStartTransaction = useCallback(
    async (chargePointId: string, payload: RemoteStartTransactionPayload): Promise<OcppCommandResponse> => {
      const ws = wsRef.current
      return ws.sendCommand(chargePointId, "RemoteStartTransaction", payload)
    },
    [],
  )

  const sendRemoteStopTransaction = useCallback(
    async (chargePointId: string, payload: RemoteStopTransactionPayload): Promise<OcppCommandResponse> => {
      const ws = wsRef.current
      return ws.sendCommand(chargePointId, "RemoteStopTransaction", payload)
    },
    [],
  )

  return {
    subscribe,
    sendRemoteStartTransaction,
    sendRemoteStopTransaction,
  }
}
