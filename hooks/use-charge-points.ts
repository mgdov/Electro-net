"use client"

import { useState, useEffect, useCallback } from "react"
import type { ChargePoint, Connector, Transaction } from "@/lib/types"
import { useWebSocket } from "./use-websocket"
import { apiClient } from "@/lib/api-client"
import type { ApiTransactionPayload } from "@/lib/api-client"
import { mapApiStations, mapApiTransactions } from "@/lib/api-mapper"

export function useChargePoints() {
  const [chargePoints, setChargePoints] = useState<ChargePoint[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const { subscribe, sendRemoteStartTransaction, sendRemoteStopTransaction } = useWebSocket()

  // Fetch stations from API
  const fetchStations = useCallback(async () => {
    // Only fetch on client side
    if (typeof window === 'undefined') {
      console.log("[API] Skipping fetch on server side")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const apiStations = await apiClient.getStations()
      const mappedStations = mapApiStations(apiStations)

      // Merge with existing optimistic updates
      setChargePoints(prev => {
        if (prev.length === 0) {
          // First load - use API data as-is
          return mappedStations
        }

        // Merge: preserve Occupied status if it was set optimistically
        return mappedStations.map(apiStation => {
          const existingStation = prev.find(p => p.id === apiStation.id)
          if (!existingStation) return apiStation

          return {
            ...apiStation,
            connectors: apiStation.connectors.map(apiConn => {
              const existingConn = existingStation.connectors.find(c => c.connectorId === apiConn.connectorId)

              // If connector was optimistically set to Occupied, keep it until API confirms
              if (existingConn?.status === 'Occupied' && apiConn.status === 'Available' && existingConn.currentTransactionId?.startsWith('optimistic-')) {
                return existingConn
              }

              // If connector was optimistically set to Available, keep it
              if (existingConn?.status === 'Available' && apiConn.status === 'Occupied' && !apiConn.currentTransactionId) {
                return existingConn
              }

              // Otherwise use API data
              return apiConn
            })
          }
        })
      })

      setIsInitialized(true)
    } catch (err) {
      console.error("Failed to fetch stations:", err)
      setError(err instanceof Error ? err.message : "Failed to load stations")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize data on client side only to avoid hydration mismatch
  useEffect(() => {
    if (!isInitialized) {
      fetchStations()
    }
  }, [isInitialized, fetchStations])

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      const apiTx = await apiClient.getTransactions()
      const mapped = mapApiTransactions(apiTx)
      const unique = Array.from(new Map(mapped.map((tx) => [tx.id, tx])).values())
      setTransactions(unique)
      console.log(`[fetchTransactions] Loaded ${unique.length} transactions`)
    } catch (e) {
      console.error("Failed to fetch transactions", e)
    }
  }, [])  // Initial load for transactions
  useEffect(() => {
    fetchTransactions()

    // Автообновление каждые 5 секунд (оптимальная частота)
    const interval = setInterval(() => {
      fetchTransactions()
      fetchStations()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchTransactions, fetchStations])
  // Polling disabled by request

  // Polling disabled by request

  useEffect(() => {
    const unsubscribeStatus = subscribe("connector.statusChanged", (event) => {
      console.log("[v0] Connector status changed:", event.data)

      setChargePoints((prev) =>
        prev.map((cp) => {
          if (cp.id === event.data.chargePointId) {
            return {
              ...cp,
              connectors: cp.connectors.map((conn) =>
                conn.connectorId === event.data.connectorId
                  ? { ...conn, status: event.data.status, lastUpdated: event.data.timestamp }
                  : conn,
              ),
            }
          }
          return cp
        }),
      )
    })

    const unsubscribeMeter = subscribe("meter.values", (event) => {
      console.log("[v0] Meter values updated:", event.data)

      setChargePoints((prev) =>
        prev.map((cp) => {
          if (cp.id === event.data.chargePointId) {
            return {
              ...cp,
              connectors: cp.connectors.map((conn) =>
                conn.connectorId === event.data.connectorId
                  ? {
                    ...conn,
                    currentPower_kW: event.data.power_kW,
                    voltage_V: event.data.voltage_V,
                    current_A: event.data.current_A,
                    soc_percent: event.data.soc_percent,
                    lastUpdated: event.data.timestamp,
                  }
                  : conn,
              ),
            }
          }
          return cp
        }),
      )
      // Accumulate energy for active transaction if exists
      setTransactions(prev => prev.map(tx => {
        if (
          tx.chargePointId === event.data.chargePointId &&
          tx.connectorId === event.data.connectorId &&
          tx.status === 'Active'
        ) {
          // Approximate incremental kWh from power over interval (assume update ~5s)
          const incrementKWh = event.data.power_kW * (5 / 3600)
          const newKWh = tx.kWh + incrementKWh
          return {
            ...tx,
            kWh: newKWh,
            cost: newKWh * 0.35,
          }
        }
        return tx
      }))
    })

    const unsubscribeTransactionStarted = subscribe("transaction.started", (event) => {
      console.log("[v0] Transaction started:", event.data)

      setChargePoints((prev) =>
        prev.map((cp) => {
          if (cp.id === event.data.chargePointId) {
            return {
              ...cp,
              connectors: cp.connectors.map((conn) =>
                conn.connectorId === event.data.connectorId
                  ? {
                    ...conn,
                    status: "Occupied",
                    currentTransactionId: event.data.transactionId,
                    lastUpdated: event.data.timestamp,
                  }
                  : conn,
              ),
            }
          }
          return cp
        }),
      )
      // Add transaction to list
      setTransactions(prev => [
        {
          id: event.data.transactionId,
          chargePointId: event.data.chargePointId,
          connectorId: event.data.connectorId,
          idTag: event.data.idTag || 'RFID-UNKNOWN',
          startTime: event.data.timestamp,
          stopTime: null,
          meterStart_Wh: 0,
          meterStop_Wh: null,
          kWh: 0,
          status: 'Active',
          userId: 'user-0',
          cost: undefined,
        },
        ...prev.filter(tx => tx.id !== event.data.transactionId),
      ])

    })

    const unsubscribeTransactionStopped = subscribe("transaction.stopped", (event) => {
      console.log("[v0] Transaction stopped:", event.data)

      setChargePoints((prev) =>
        prev.map((cp) => {
          if (cp.id === event.data.chargePointId) {
            return {
              ...cp,
              connectors: cp.connectors.map((conn) =>
                conn.currentTransactionId === event.data.transactionId
                  ? {
                    ...conn,
                    status: "Available",
                    currentTransactionId: null,
                    currentPower_kW: 0,
                    soc_percent: null,
                    lastUpdated: event.data.timestamp,
                  }
                  : conn,
              ),
            }
          }
          return cp
        }),
      )
      // Mark transaction completed
      let stopPayloadData: ApiTransactionPayload | null = null
      setTransactions(prev => prev.map(tx => {
        if (tx.id !== event.data.transactionId) return tx

        const meterStopWh = tx.meterStart_Wh + Math.floor(Math.random() * 10000)
        const calculatedKWh = tx.kWh || (meterStopWh - tx.meterStart_Wh) / 1000
        const cost = calculatedKWh * 0.35
        const updatedTx: Transaction = {
          ...tx,
          stopTime: event.data.timestamp,
          status: "Completed",
          meterStop_Wh: meterStopWh,
          kWh: calculatedKWh,
          cost,
        }

        stopPayloadData = {
          id: updatedTx.id,
          chargePointId: updatedTx.chargePointId,
          connectorId: updatedTx.connectorId,
          startTime: updatedTx.startTime,
          stopTime: updatedTx.stopTime,
          meterStart: updatedTx.meterStart_Wh,
          meterStop: updatedTx.meterStop_Wh,
          totalKWh: updatedTx.kWh,
          cost: updatedTx.cost ?? null,
          idTag: updatedTx.idTag ?? null,
          energy: updatedTx.kWh,
          efficiencyPercentage: null,
          reason: "Completed",
          transactionData: null,
        }

        return updatedTx
      }))

      if (stopPayloadData) {
        void (async () => {
          const ok = await apiClient.postTransaction(stopPayloadData!)
          if (!ok) {
            console.warn("[Transactions] Failed to post stop transaction", event.data.transactionId)
          }
        })()
      }
    })

    return () => {
      unsubscribeStatus()
      unsubscribeMeter()
      unsubscribeTransactionStarted()
      unsubscribeTransactionStopped()
    }
  }, [subscribe])

  const updateConnectorStatus = (chargePointId: string, connectorId: number, status: Connector["status"]) => {
    setChargePoints((prev) =>
      prev.map((cp) => {
        if (cp.id === chargePointId) {
          return {
            ...cp,
            connectors: cp.connectors.map((conn) =>
              conn.connectorId === connectorId ? { ...conn, status, lastUpdated: new Date().toISOString() } : conn,
            ),
          }
        }
        return cp
      }),
    )
  }

  const startCharging = async (chargePointId: string, connectorId: number, idTag = "FRONTEND_USER") => {
    console.log(`[startCharging] ${chargePointId} connector ${connectorId}`)
    try {
      const response = await apiClient.remoteStartSession({
        chargePointId,
        connectorId,
        idTag
      })
      console.log("[startCharging] Response:", response.success ? "Success" : "Failed")

      if (response?.success) {
        // Обновляем локальное состояние оптимистично
        setChargePoints(prev => prev.map(cp => {
          if (cp.id !== chargePointId) return cp
          return {
            ...cp,
            connectors: cp.connectors.map(conn => {
              if (conn.connectorId !== connectorId) return conn
              return {
                ...conn,
                status: "Occupied",
                lastUpdated: new Date().toISOString(),
              }
            })
          }
        }))
      }

      // Обновляем данные через 2 секунды
      setTimeout(() => {
        fetchTransactions()
        fetchStations()
      }, 2000)

      return response
    } catch (error) {
      console.error("[startCharging] Error:", error)
      throw error
    }
  }

  const stopCharging = async (chargePointId: string, transactionId: string) => {
    console.log(`[stopCharging] Starting for ${chargePointId} transaction ${transactionId}`)

    // Находим connectorId по transactionId, как в рабочем фронтенде
    let connectorId: number | null = null
    console.log(`[stopCharging] Searching for connectorId in chargePoints:`, chargePoints)

    for (const cp of chargePoints) {
      if (cp.id === chargePointId) {
        console.log(`[stopCharging] Found charge point:`, cp)
        for (const conn of cp.connectors) {
          console.log(`[stopCharging] Checking connector:`, conn)
          if (conn.currentTransactionId === transactionId) {
            connectorId = conn.connectorId
            console.log(`[stopCharging] Found matching connector: ${connectorId}`)
            break
          }
        }
        break
      }
    }

    if (connectorId === null) {
      console.error('[stopCharging] ❌ No active transaction found for', transactionId)
      console.error('[stopCharging] Available charge points:', chargePoints)
      throw new Error('Нет активной транзакции для остановки')
    }

    try {
      console.log(`[stopCharging] Calling API with connectorId: ${connectorId}`)
      // Используем API клиент вместо WebSocket, как в рабочем фронтенде
      const response = await apiClient.remoteStopSession({
        chargePointId,
        connectorId,
        transactionId: typeof transactionId === 'string' ? parseInt(transactionId) : transactionId
      })
      console.log("[stopCharging] API response:", response)

      if (response?.success) {
        console.log("[stopCharging] Success! Updating local state...")
        // Обновляем локальное состояние оптимистично
        setChargePoints(prev => prev.map(cp => {
          if (cp.id !== chargePointId) return cp
          return {
            ...cp,
            connectors: cp.connectors.map(conn => {
              if (conn.currentTransactionId !== transactionId) return conn
              return {
                ...conn,
                status: "Available",
                currentTransactionId: null,
                currentPower_kW: 0,
                soc_percent: null,
                lastUpdated: new Date().toISOString(),
              }
            })
          }
        }))

        setTransactions(prev => prev.map(tx => tx.id === transactionId ? {
          ...tx,
          stopTime: new Date().toISOString(),
          status: "Completed",
        } : tx))
      }

      // Обновляем транзакции после 2 секунд, как в рабочем фронтенде
      console.log("[stopCharging] Scheduling data refresh in 2 seconds...")
      setTimeout(() => {
        console.log("[stopCharging] Refreshing transactions and stations...")
        fetchTransactions()
        fetchStations() // Также обновляем станции
      }, 2000)

      return response
    } catch (error) {
      console.error("[stopCharging] Error:", error)
      throw error
    }
  }

  return {
    chargePoints,
    transactions,
    isLoading,
    error,
    updateConnectorStatus,
    startCharging,
    stopCharging,
    refreshStations: fetchStations,
  }
}
