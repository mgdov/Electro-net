"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  // Быстрый индекс: transactionId -> { chargePointId, connectorId }
  const transactionConnectorMap = useRef<Map<string, { chargePointId: string; connectorId: number }>>(new Map())
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
      const apiStations = await apiClient.getStations().catch(err => {
        console.error('[fetchStations] request failed:', err)
        throw err
      })
      console.log('[fetchStations] received', apiStations.length, 'stations')
      const mappedStations = mapApiStations(apiStations)
      console.log('[fetchStations] mapped stations sample:', mappedStations[0])

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

              // If connector was optimistically set to Available (after stop), keep it even if API still shows Occupied
              if (existingConn?.status === 'Available' && apiConn.status === 'Occupied') {
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
      const apiTx = await apiClient.getTransactions().catch(err => {
        console.error('[fetchTransactions] request failed:', err)
        throw err
      })
      console.log('[fetchTransactions] raw apiTx length:', apiTx.length)
      const mapped = mapApiTransactions(apiTx)
      const unique = Array.from(new Map(mapped.map((tx) => [tx.id, tx])).values())
      setTransactions(unique)
      console.log(`[fetchTransactions] Loaded ${unique.length} transactions`)
    } catch (e) {
      console.error("Failed to fetch transactions", e)
    }
  }, [])  // Initial load for transactions
  useEffect(() => {
    // Только однократная загрузка транзакций без авто-поллинга
    fetchTransactions()
  }, [fetchTransactions])
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
                  ? { ...conn, status: event.data.status, errorCode: event.data.errorCode, lastUpdated: event.data.timestamp }
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
                    awaitingTransactionId: false,
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
      // Заменить оптимистичную транзакцию или добавить новую
      setTransactions(prev => {
        let replaced = false
        const updated = prev.map(tx => {
          if (!replaced && tx.chargePointId === event.data.chargePointId && tx.connectorId === event.data.connectorId && tx.id.startsWith('optimistic-')) {
            replaced = true
            return { ...tx, id: event.data.transactionId }
          }
          return tx
        })
        if (!replaced && !updated.find(t => t.id === event.data.transactionId)) {
          return [
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
            ...updated
          ]
        }
        return updated
      })

      // Обновляем индекс
      transactionConnectorMap.current.set(String(event.data.transactionId), {
        chargePointId: event.data.chargePointId,
        connectorId: event.data.connectorId,
      })
      console.log("[transaction.started] Set map for tx", String(event.data.transactionId), "map size:", transactionConnectorMap.current.size)

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
                    awaitingTransactionId: false,
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

      // Удаляем из индекса
      transactionConnectorMap.current.delete(String(event.data.transactionId))
      console.log("[transaction.stopped] Deleted from map tx", String(event.data.transactionId), "map size:", transactionConnectorMap.current.size)
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

  // Track active polling attempts to avoid duplicates (cpId:connectorId)
  const pendingTransactionPolls = useRef<Set<string>>(new Set())

  const startCharging = async (chargePointId: string, connectorId: number, idTag = "FRONTEND_USER") => {
    console.log(`[startCharging] ${chargePointId} connector ${connectorId}`)
    try {
      const response = await apiClient.remoteStartSession({
        chargePointId,
        connectorId,
        idTag
      })
      console.log("[startCharging] Response:", response.success ? "Success" : "Failed", response?.data)

      if (response?.success) {
        // 1. Optimistic local state (без transactionId пока нет события)
        setChargePoints(prev => prev.map(cp => {
          if (cp.id !== chargePointId) return cp
          return {
            ...cp,
            connectors: cp.connectors.map(conn => {
              if (conn.connectorId !== connectorId) return conn
              return {
                ...conn,
                status: "Occupied",
                // Маркер, что мы в ожидании transactionId
                currentTransactionId: conn.currentTransactionId ?? null,
                awaitingTransactionId: true,
                lastUpdated: new Date().toISOString(),
              }
            })
          }
        }))

        // 1a. Добавить оптимистичную транзакцию сразу в список (будет заменена когда появится настоящий id)
        const optimisticId = `optimistic-${chargePointId}-${connectorId}-${Date.now()}`
        setTransactions(prev => {
          // Удаляем старые оптимистичные для этого коннектора
          const filtered = prev.filter(tx => !(tx.chargePointId === chargePointId && tx.connectorId === connectorId && tx.id.startsWith('optimistic-')))
          return [
            {
              id: optimisticId,
              chargePointId,
              connectorId,
              idTag,
              startTime: new Date().toISOString(),
              stopTime: null,
              meterStart_Wh: 0,
              meterStop_Wh: null,
              kWh: 0,
              status: 'Active',
              userId: 'user-0',
              cost: undefined,
            },
            ...filtered
          ]
        })

        const immediateTxId = response.data?.transactionId || response.data?.id || response.data?.txId
        if (immediateTxId) {
          const txIdStr = String(immediateTxId)
          transactionConnectorMap.current.set(txIdStr, { chargePointId, connectorId })
          console.log(`[startCharging] Set map for immediate tx=${txIdStr}, map size:`, transactionConnectorMap.current.size)
          setChargePoints(prev => prev.map(cp => cp.id !== chargePointId ? cp : ({
            ...cp,
            connectors: cp.connectors.map(c => c.connectorId !== connectorId ? c : ({
              ...c,
              currentTransactionId: txIdStr,
              status: "Occupied",
              awaitingTransactionId: false
            }))
          })))

          // Заменяем оптимистичную транзакцию настоящей
          setTransactions(prev => {
            let replaced = false
            const updated = prev.map(tx => {
              if (!replaced && tx.chargePointId === chargePointId && tx.connectorId === connectorId && tx.id.startsWith('optimistic-')) {
                replaced = true
                return { ...tx, id: txIdStr }
              }
              return tx
            })
            if (!replaced) {
              return [
                {
                  id: txIdStr,
                  chargePointId,
                  connectorId,
                  idTag,
                  startTime: new Date().toISOString(),
                  stopTime: null,
                  meterStart_Wh: 0,
                  meterStop_Wh: null,
                  kWh: 0,
                  status: 'Active',
                  userId: 'user-0',
                  cost: undefined,
                },
                ...updated.filter(t => t.id !== txIdStr)
              ]
            }
            return updated
          })
          console.log(`[startCharging] Applied immediate transactionId=${txIdStr}`)
          return response
        }

        // 3. Запускаем короткий опрос для быстрого получения настоящего transactionId без ручного обновления страницы
        const key = `${chargePointId}:${connectorId}`
        if (!pendingTransactionPolls.current.has(key)) {
          pendingTransactionPolls.current.add(key)
            ; (async () => {
              const maxAttempts = 10
              for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                  const stations = await apiClient.getStations()
                  const station = stations.find(s => s.id === chargePointId)
                  const apiConn = station?.connectors.find(c => c.id === connectorId)
                  const foundTxId = apiConn?.transactionId
                  if (foundTxId) {
                    const txIdStr = String(foundTxId)
                    transactionConnectorMap.current.set(txIdStr, { chargePointId, connectorId })
                    console.log(`[startCharging] Set map for captured tx=${txIdStr}, map size:`, transactionConnectorMap.current.size)
                    setChargePoints(prev => prev.map(cp => cp.id !== chargePointId ? cp : ({
                      ...cp,
                      connectors: cp.connectors.map(c => c.connectorId !== connectorId ? c : ({
                        ...c,
                        currentTransactionId: txIdStr,
                        status: "Occupied",
                        awaitingTransactionId: false
                      }))
                    })))
                    // Replace optimistic
                    setTransactions(prev => {
                      let replaced = false
                      const updated = prev.map(tx => {
                        if (!replaced && tx.chargePointId === chargePointId && tx.connectorId === connectorId && tx.id.startsWith('optimistic-')) {
                          replaced = true
                          return { ...tx, id: txIdStr }
                        }
                        return tx
                      })
                      if (!replaced) {
                        return [
                          {
                            id: txIdStr,
                            chargePointId,
                            connectorId,
                            idTag,
                            startTime: new Date().toISOString(),
                            stopTime: null,
                            meterStart_Wh: 0,
                            meterStop_Wh: null,
                            kWh: 0,
                            status: 'Active',
                            userId: 'user-0',
                            cost: undefined,
                          },
                          ...updated.filter(t => t.id !== txIdStr)
                        ]
                      }
                      return updated
                    })
                    console.log(`[startCharging] Captured transactionId=${txIdStr} after ${attempt} attempt(s)`)
                    break
                  }
                } catch (pollErr) {
                  console.warn(`[startCharging] Poll attempt failed ${attempt}:`, pollErr)
                }
                // Если это не последний цикл — пауза
                if (attempt < maxAttempts) {
                  await new Promise(r => setTimeout(r, 800))
                } else {
                  console.warn(`[startCharging] TransactionId not detected after ${maxAttempts} attempts (≈${(maxAttempts * 0.8).toFixed(1)}s)`)
                }
              }
              pendingTransactionPolls.current.delete(key)
            })()
        }
      }

      return response
    } catch (error) {
      console.error("[startCharging] Error:", error)
      throw error
    }
  }

  const stopCharging = async (chargePointId: string, transactionId: string) => {
    const normalizedTransactionId = String(transactionId)
    console.log(`[stopCharging] Requested stop: cp=${chargePointId} tx=${normalizedTransactionId}`)
    console.log("[stopCharging] Map keys:", Array.from(transactionConnectorMap.current.keys()))
    console.log("[stopCharging] Looking for:", normalizedTransactionId)

    // 1. Быстрый путь через индекс
    let mapping = transactionConnectorMap.current.get(normalizedTransactionId)
    if (!mapping) {
      console.warn(`[stopCharging] Mapping not found in index for tx=${normalizedTransactionId}, fallback to scan`)
      // 2. Fallback: однократное сканирование текущего состояния
      for (const cp of chargePoints) {
        for (const conn of cp.connectors) {
          if (conn.currentTransactionId && String(conn.currentTransactionId) === normalizedTransactionId) {
            mapping = { chargePointId: cp.id, connectorId: conn.connectorId }
            console.log(`[stopCharging] Fallback found connectorId=${conn.connectorId} at cp=${cp.id}`)
            break
          }
        }
        if (mapping) break
      }
    }

    // 3. Проверка совпадения целевой станции
    if (mapping && mapping.chargePointId !== chargePointId) {
      console.warn(`[stopCharging] Provided chargePointId (${chargePointId}) differs from indexed (${mapping.chargePointId}). Using indexed.`)
    }

    if (!mapping) {
      console.error('[stopCharging] ❌ No active transaction found after index & fallback scan for', normalizedTransactionId)
      console.error('[stopCharging] Diagnostic snapshot:', JSON.stringify(chargePoints.map(cp => ({
        id: cp.id,
        connectors: cp.connectors.map(c => ({ id: c.connectorId, status: c.status, currentTransactionId: c.currentTransactionId }))
      })), null, 2))
      throw new Error('Нет активной транзакции для остановки')
    }

    const { connectorId } = mapping
    console.log(`[stopCharging] Using connectorId=${connectorId}`)

    try {
      const response = await apiClient.remoteStopSession({
        chargePointId: mapping.chargePointId,
        connectorId,
        transactionId: /^\d+$/.test(normalizedTransactionId) ? parseInt(normalizedTransactionId, 10) : normalizedTransactionId
      })
      console.log('[stopCharging] API response:', response)

      if (response?.success) {
        // Обновляем локально с расчётами
        let stopPayloadData: ApiTransactionPayload | null = null
        setChargePoints(prev => prev.map(cp => {
          if (cp.id !== mapping!.chargePointId) return cp
          return {
            ...cp,
            connectors: cp.connectors.map(conn => {
              if (String(conn.currentTransactionId) !== normalizedTransactionId) return conn
              return {
                ...conn,
                status: 'Available',
                currentTransactionId: null,
                currentPower_kW: 0,
                soc_percent: null,
                lastUpdated: new Date().toISOString(),
              }
            })
          }
        }))

        setTransactions(prev => prev.map(tx => {
          if (String(tx.id) !== normalizedTransactionId) return tx

          const meterStopWh = tx.meterStart_Wh + Math.floor(Math.random() * 10000)
          const calculatedKWh = tx.kWh || (meterStopWh - tx.meterStart_Wh) / 1000
          const cost = calculatedKWh * 0.35
          const updatedTx: Transaction = {
            ...tx,
            stopTime: new Date().toISOString(),
            status: 'Completed',
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
              console.warn("[Transactions] Failed to post stop transaction", normalizedTransactionId)
            }
          })()
        }

        // Всегда обновляем станции сразу после стопа, чтобы получить актуальный статус коннекторов
        await fetchStations()
      }

      return response
    } catch (error) {
      console.error('[stopCharging] Error:', error)
      throw error
    }
  }

  const clearTransactions = async () => {
    try {
      const ok = await apiClient.deleteRecentTransactions()
      if (ok) {
        setTransactions([])
      }
      return ok
    } catch (e) {
      console.error('[clearTransactions] Error:', e)
      return false
    }
  }

  const deleteTransaction = async (transactionId: string) => {
    // Оптимистичное удаление
    let snapshot: Transaction[] | null = null
    setTransactions(prev => {
      snapshot = prev
      return prev.filter(tx => tx.id !== transactionId)
    })
    const result = await apiClient.deleteTransaction(transactionId)
    if (!result.success && snapshot) {
      // Откат при ошибке
      setTransactions(snapshot)
    }
    return result
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
    clearTransactions,
    deleteTransaction,
  }
}
