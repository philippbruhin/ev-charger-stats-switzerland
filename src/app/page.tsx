"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface StationsData {
  EVSEData?: Array<{
    OperatorID: string
    OperatorName: string
    EVSEDataRecord?: Array<{
      EvseID: string
      Address: {
        City: string
        Street: string
        PostalCode?: string
      }
      HotlinePhoneNumber?: string
      PaymentOptions?: string[]
    }>
  }>
}

interface StatusData {
  EVSEStatuses?: Array<{
    OperatorID: string
    OperatorName: string
    EVSEStatusRecord?: Array<{
      EvseID: string
      EVSEStatus: string
    }>
  }>
}

interface MergedOperatorData {
  operatorId: string
  operatorName: string
  totalStations: number
  statusCounts: {
    available: number
    occupied: number
    outoforder: number
    unknown: number
  }
  stationIds: string[]
  statusDetails: Record<string, string>
}

export default function DataCollectionPage() {
  const [stationsData, setStationsData] = useState<StationsData | null>(null)
  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [stationsLoading, setStationsLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [stationsError, setStationsError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const fetchStationsData = async () => {
    setStationsLoading(true)
    setStationsError(null)
    try {
      console.log("Fetching stations data...")
      const response = await fetch(
        "https://data.geo.admin.ch/ch.bfe.ladestellen-elektromobilitaet/data/ch.bfe.ladestellen-elektromobilitaet.json",
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Stations data received:", data)
      setStationsData(data)
    } catch (error) {
      console.error("Error fetching stations:", error)
      setStationsError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setStationsLoading(false)
    }
  }

  const fetchStatusData = async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      console.log("Fetching status data...")
      const response = await fetch(
        "https://data.geo.admin.ch/ch.bfe.ladestellen-elektromobilitaet/status/ch.bfe.ladestellen-elektromobilitaet.json",
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Status data received:", data)
      setStatusData(data)
    } catch (error) {
      console.error("Error fetching status:", error)
      setStatusError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setStatusLoading(false)
    }
  }

  const fetchBothAPIs = async () => {
    await Promise.all([fetchStationsData(), fetchStatusData()])
  }

  useEffect(() => {
    fetchBothAPIs()
  }, [])

  // Merge stations and status data per operator
  const mergedOperatorData: MergedOperatorData[] = (() => {
    if (!stationsData?.EVSEData) return []

    // Create a map of all station statuses
    const statusMap = new Map<string, string>()
    if (statusData?.EVSEStatuses) {
      statusData.EVSEStatuses.forEach((operator) => {
        operator.EVSEStatusRecord?.forEach((record) => {
          statusMap.set(record.EvseID, record.EVSEStatus.toLowerCase())
        })
      })
    }

    // Process each operator
    return stationsData.EVSEData.map((operator) => {
      const stationIds = operator.EVSEDataRecord?.map((record) => record.EvseID) || []
      const statusDetails: Record<string, string> = {}
      const statusCounts = {
        available: 0,
        occupied: 0,
        outoforder: 0,
        unknown: 0,
      }

      // Count statuses for this operator
      stationIds.forEach((stationId) => {
        const status = statusMap.get(stationId) || "unknown"
        statusDetails[stationId] = status

        // Normalize status names
        if (status === "available" || status === "free") {
          statusCounts.available++
        } else if (status === "occupied" || status === "charging") {
          statusCounts.occupied++
        } else if (status === "outoforder" || status === "faulted" || status === "offline") {
          statusCounts.outoforder++
        } else {
          statusCounts.unknown++
        }
      })

      return {
        operatorId: operator.OperatorID,
        operatorName: operator.OperatorName,
        totalStations: stationIds.length,
        statusCounts,
        stationIds,
        statusDetails,
      }
    }).sort((a, b) => b.totalStations - a.totalStations) // Sort by total stations descending
  })()

  // Calculate overall stats
  const overallStats = {
    totalOperators: mergedOperatorData.length,
    totalStations: mergedOperatorData.reduce((sum, op) => sum + op.totalStations, 0),
    totalAvailable: mergedOperatorData.reduce((sum, op) => sum + op.statusCounts.available, 0),
    totalOccupied: mergedOperatorData.reduce((sum, op) => sum + op.statusCounts.occupied, 0),
    totalOutOfOrder: mergedOperatorData.reduce((sum, op) => sum + op.statusCounts.outoforder, 0),
    totalUnknown: mergedOperatorData.reduce((sum, op) => sum + op.statusCounts.unknown, 0),
  }

  // Prepare chart data
  const chartData = mergedOperatorData.map((operator) => ({
    operator:
      operator.operatorName.length > 20 ? operator.operatorName.substring(0, 20) + "..." : operator.operatorName,
    fullOperator: operator.operatorName,
    available: operator.statusCounts.available,
    occupied: operator.statusCounts.occupied,
    outoforder: operator.statusCounts.outoforder,
    unknown: operator.statusCounts.unknown,
    total: operator.totalStations,
  }))

  const chartConfig = {
    available: {
      label: "Available",
      color: "#22c55e", // Green
    },
    occupied: {
      label: "Occupied",
      color: "#eab308", // Yellow
    },
    outoforder: {
      label: "Out of Order",
      color: "#ef4444", // Red
    },
    unknown: {
      label: "Unknown",
      color: "#94a3b8", // Gray
    },
  }

  return (
    <main className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">EV Chargers by Operator</h1>
        <Button onClick={fetchBothAPIs} disabled={stationsLoading || statusLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Loading States */}
      {(stationsLoading || statusLoading) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading data...
              {stationsLoading && " (fetching stations)"}
              {statusLoading && " (fetching status)"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {(stationsError || statusError) && (
        <Card>
          <CardContent className="pt-6">
            {stationsError && (
              <div className="text-red-600 bg-red-50 p-3 rounded mb-2">Stations Error: {stationsError}</div>
            )}
            {statusError && <div className="text-red-600 bg-red-50 p-3 rounded">Status Error: {statusError}</div>}
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {mergedOperatorData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chargers by Operator - Status Overview</CardTitle>
            <CardDescription>
              Real-time status of charging stations grouped by operator. Last updated: {new Date().toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[600px] w-full">
              <BarChart
                data={chartData}
                width={1000}
                height={500}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="operator" angle={-45} textAnchor="end" height={100} interval={0} fontSize={12} />
                <YAxis />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        const label = chartConfig[name as keyof typeof chartConfig]?.label || name
                        return [value, label]
                      }}
                      labelFormatter={(label, payload) => {
                        const data = payload?.[0]?.payload
                        return data ? data.fullOperator : label
                      }}
                    />
                  }
                />
                <Legend />
                <Bar dataKey="available" stackId="a" fill={chartConfig.available.color} name="Available" />
                <Bar dataKey="occupied" stackId="a" fill={chartConfig.occupied.color} name="Occupied" />
                <Bar dataKey="outoforder" stackId="a" fill={chartConfig.outoforder.color} name="Out of Order" />
                <Bar dataKey="unknown" stackId="a" fill={chartConfig.unknown.color} name="Unknown" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Overall Statistics */}
      {mergedOperatorData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Statistics</CardTitle>
            <CardDescription>Combined data from both APIs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-blue-50 p-3 rounded text-center">
                <div className="text-2xl font-bold">{overallStats.totalOperators}</div>
                <div className="text-sm text-muted-foreground">Operators</div>
              </div>
              <div className="bg-gray-50 p-3 rounded text-center">
                <div className="text-2xl font-bold">{overallStats.totalStations}</div>
                <div className="text-sm text-muted-foreground">Total Stations</div>
              </div>
              <div className="bg-green-50 p-3 rounded text-center">
                <div className="text-2xl font-bold">{overallStats.totalAvailable}</div>
                <div className="text-sm text-muted-foreground">Available</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded text-center">
                <div className="text-2xl font-bold">{overallStats.totalOccupied}</div>
                <div className="text-sm text-muted-foreground">Occupied</div>
              </div>
              <div className="bg-red-50 p-3 rounded text-center">
                <div className="text-2xl font-bold">{overallStats.totalOutOfOrder}</div>
                <div className="text-sm text-muted-foreground">Out of Order</div>
              </div>
              <div className="bg-gray-50 p-3 rounded text-center">
                <div className="text-2xl font-bold">{overallStats.totalUnknown}</div>
                <div className="text-sm text-muted-foreground">Unknown</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Operators with Merged Data */}
      {mergedOperatorData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Operators with Status Data ({mergedOperatorData.length})</CardTitle>
            <CardDescription>Stations data merged with real-time status information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mergedOperatorData.map((operator) => (
                <div key={operator.operatorId} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-lg">{operator.operatorName}</h4>
                      <p className="text-sm text-muted-foreground">ID: {operator.operatorId}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{operator.totalStations}</div>
                      <div className="text-sm text-muted-foreground">Total Stations</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-green-50 p-2 rounded text-center">
                      <div className="font-bold text-green-700">{operator.statusCounts.available}</div>
                      <div className="text-xs text-muted-foreground">Available</div>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded text-center">
                      <div className="font-bold text-yellow-700">{operator.statusCounts.occupied}</div>
                      <div className="text-xs text-muted-foreground">Occupied</div>
                    </div>
                    <div className="bg-red-50 p-2 rounded text-center">
                      <div className="font-bold text-red-700">{operator.statusCounts.outoforder}</div>
                      <div className="text-xs text-muted-foreground">Out of Order</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-bold text-gray-700">{operator.statusCounts.unknown}</div>
                      <div className="text-xs text-muted-foreground">Unknown</div>
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground">
                    Operational Rate:{" "}
                    <span className="font-semibold">
                      {operator.totalStations > 0
                        ? Math.round((operator.statusCounts.available / operator.totalStations) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
