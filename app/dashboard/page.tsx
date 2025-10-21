"use client"

import { ChargePointsGrid } from "@/components/charge-points-grid"
import { DashboardHeader } from "@/components/dashboard-header"
import { useChargePoints } from "@/hooks/use-charge-points"
import { DashboardStats } from "@/components/dashboard-stats"
import { TransactionsFilters } from "@/components/transactions-filters"
import { TransactionsTable } from "@/components/transactions-table"
import { useEffect } from "react"
export default function DashboardPage() {
  const { chargePoints, startCharging, stopCharging, transactions, isLoading, error } = useChargePoints()

  // Show loading state while data is being initialized to avoid hydration mismatch
  if (isLoading && chargePoints.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Зарядные станции</h1>
            <p className="text-muted-foreground">Управление и мониторинг зарядных станций в реальном времени</p>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Загрузка данных с сервера...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Зарядные станции</h1>
            <p className="text-muted-foreground">Управление и мониторинг зарядных станций в реальном времени</p>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="text-destructive">Ошибка загрузки: {error}</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Зарядные станции</h1>
          <p className="text-muted-foreground">Управление и мониторинг зарядных станций в реальном времени</p>
        </div>

        <DashboardStats chargePoints={chargePoints} />
        <ChargePointsGrid chargePoints={chargePoints} onStart={startCharging} onStop={stopCharging} />

        <div className="mt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Транзакции</h2>
          <TransactionsFilters />
          {transactions.length === 0 ? (
            <div className="text-sm text-muted-foreground">Пока нет транзакций</div>
          ) : (
            <TransactionsTable transactions={transactions} />
          )}
        </div>
      </main>
    </div>
  )
}
