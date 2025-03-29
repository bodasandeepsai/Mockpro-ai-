"use client";
import React, { useEffect, useState } from 'react';
import { db } from '@/utils/db';
import { MockInterview, UserAnswer } from '@/utils/schema';
import { useUser } from '@clerk/nextjs';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MessageSquare, Play, Star, Calendar, Briefcase, Filter } from "lucide-react";
import moment from 'moment';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

function HistoryPage() {
    const { user } = useUser();
    const router = useRouter();
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [answers, setAnswers] = useState([]);
    const [interview, setInterview] = useState(null);
    const [filters, setFilters] = useState({
        status: 'all',
        dateRange: 'all',
        search: ''
    });

    useEffect(() => {
        const fetchInterviews = async () => {
            try {
                if (!user?.primaryEmailAddress?.emailAddress) return;

                // Fetch all interviews for the user in a single query
                const data = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.createdBy, user.primaryEmailAddress.emailAddress));

                // Fetch all answers for these interviews in a single query
                if (data.length > 0) {
                    const mockIds = data.map(interview => interview.mockId);
                    const answers = await db.select()
                        .from(UserAnswer)
                        .where(eq(UserAnswer.mockIdref, mockIds[0])); // Get answers for the first interview

                    // Add status to each interview based on answers
                    const interviewsWithStatus = data.map(interview => ({
                        ...interview,
                        status: answers.some(answer => answer.feedback) ? 'completed' : 'in_progress'
                    }));

                    setInterviews(interviewsWithStatus);
                } else {
                    setInterviews([]);
                }
            } catch (error) {
                console.error('Error fetching interviews:', error);
                toast.error('Failed to load interviews');
            } finally {
                setLoading(false);
            }
        };

        fetchInterviews();
    }, [user]);

    const filteredInterviews = interviews.filter(interview => {
        if (filter === 'completed') return interview.status === 'completed';
        if (filter === 'in_progress') return interview.status === 'in_progress';
        return true;
    });

    const sortedInterviews = [...filteredInterviews].sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        return 0;
    });

    const getInterviewStatus = async (mockId) => {
        try {
            const answers = await db.select()
                .from(UserAnswer)
                .where(eq(UserAnswer.mockIdref, mockId));
            
            if (answers.length === 0) return 'Pending';
            
            const averageRating = answers.reduce((acc, curr) => acc + (parseInt(curr.rating) || 0), 0) / answers.length;
            return `Completed (${averageRating.toFixed(1)}/5)`;
        } catch (error) {
            console.error('Error getting interview status:', error);
            return 'Unknown';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <Link href="/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Link>
            </div>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Interview History</h1>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Interviews</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                </select>

                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>

            {sortedInterviews.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">No interviews found.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {sortedInterviews.map((interview) => (
                        <div key={interview.mockId} className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {interview.jobPosition}
                                    </h3>
                                    <p className="mt-2 text-gray-600">{interview.jobExperience}</p>
                                </div>
                                {interview.status === 'completed' && (
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                )}
                            </div>

                            <div className="mt-4">
                                <Link 
                                    href={`/dashboard/interview/${interview.mockId}/feedback?mockId=${interview.mockId}`}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    View Details →
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default HistoryPage; 