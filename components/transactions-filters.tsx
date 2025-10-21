"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter } from "lucide-react"

export function TransactionsFilters() {
  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по ID транзакции, станции или пользователю..."
          className="pl-10 bg-secondary border-border"
        />
      </div>

      <Select defaultValue="all">
        <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          <SelectItem value="active">Активные</SelectItem>
          <SelectItem value="completed">Завершенные</SelectItem>
          <SelectItem value="failed">Ошибки</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all">
        <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border">
          <SelectValue placeholder="Станция" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все станции</SelectItem>
          <SelectItem value="cp-001">Станция Центр</SelectItem>
          <SelectItem value="cp-002">Станция Север</SelectItem>
          <SelectItem value="cp-003">Станция Юг</SelectItem>
          <SelectItem value="cp-004">Станция Восток</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" className="shrink-0 bg-transparent">
        <Filter className="h-4 w-4" />
      </Button>
    </div>
  )
}
