import React from 'react'
import AddNewInterview from '../_components/AddNewInterview'

function InterviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">New Interview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Start a new AI-powered mock interview session.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <AddNewInterview />
        </div>
      </div>
    </div>
  )
}

export default InterviewPage 