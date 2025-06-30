import React from 'react'
import InterviewList from './_components/InterviewList'
import DashboardStats from './_components/DashboardStats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
    TrendingUp, 
    Calendar, 
    Target, 
    Award,
    Plus,
    BarChart3
} from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
        {/* Header Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Track your interview progress and performance
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <DashboardStats />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-semibold">Recent Interviews</CardTitle>
                  <Link href="/dashboard/history">
                    <button className="px-4 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200 font-medium">View All</button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <InterviewList />
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Insights */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/dashboard/interview" className="block">
                  <Button className="w-full justify-start" size="lg">
                    <Plus className="w-4 h-4 mr-2" />
                    Start New Interview
                  </Button>
                </Link>
                <Link href="/dashboard/history" className="block">
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View History
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Performance Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Performance Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Target className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Completion Rate</p>
                      <p className="text-xs text-gray-600">This month</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">0%</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Best Performance</p>
                      <p className="text-xs text-gray-600">Average rating</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">0.0/5</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-full">
                      <Calendar className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Active Streak</p>
                      <p className="text-xs text-gray-600">Days in a row</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800">0 days</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
