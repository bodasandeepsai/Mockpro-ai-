import React from 'react'
import InterviewList from './_components/InterviewList'
import DashboardStats from './_components/DashboardStats'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back!</h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening with your mock interviews.
        </p>
      </div>

      {/* Stats Grid */}
      <DashboardStats />

      {/* Recent Interviews */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Interviews</h3>
          <div className="mt-5">
            <InterviewList />
          </div>
        </div>
      </div>
    </div>
  )
}
