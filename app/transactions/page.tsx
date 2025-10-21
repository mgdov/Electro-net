"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { TransactionsTable } from "@/components/transactions-table"
import { TransactionsFilters } from "@/components/transactions-filters"
import { useChargePoints } from "@/hooks/use-charge-points"

export default function TransactionsPage() {
  const { transactions } = useChargePoints()

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">История транзакций</h1>
          <p className="text-muted-foreground">Журнал всех зарядных сессий (данные с API)</p>
        </div>

        <TransactionsFilters />
        {transactions.length === 0 ? (
          <div className="text-sm text-muted-foreground">Нет транзакций</div>
        ) : (
          <TransactionsTable transactions={transactions} />
        )}
      </main>
    </div>
  )
}
