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
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('all');

    useEffect(() => {
        if (user?.primaryEmailAddress?.emailAddress) {
            fetchInterviews();
        }
    }, [user]);

    const fetchInterviews = async () => {
        try {
            if (!user?.primaryEmailAddress?.emailAddress) return;
            setLoading(true);

            // Fetch all interviews for the user
            const interviewData = await db.select()
                .from(MockInterview)
                .where(eq(MockInterview.createdBy, user.primaryEmailAddress.emailAddress))
                .orderBy(desc(MockInterview.createdAt));

            // Prepare to fetch status info for each interview
            const interviewsWithStatus = await Promise.all(
                interviewData.map(async (interview) => {
                    // Fetch answers for this specific interview
                    const answers = await db.select()
                        .from(UserAnswer)
                        .where(eq(UserAnswer.mockIdref, interview.mockId));
                    
                    // Calculate status and average rating
                    const hasAnswers = answers.length > 0;
                    const isCompleted = answers.some(answer => answer.feedback);
                    
                    // Calculate average rating if there are ratings
                    let averageRating = 0;
                    if (hasAnswers) {
                        const validRatings = answers
                            .map(answer => {
                                if (!answer.rating) return 0;
                                // Handle ratings like "4/5" or just "4"
                                const match = answer.rating.match(/^(\d+)/);
                                return match ? parseInt(match[1]) : 0;
                            })
                            .filter(rating => rating > 0);
                            
                        if (validRatings.length > 0) {
                            averageRating = validRatings.reduce((acc, curr) => acc + curr, 0) / validRatings.length;
                        }
                    }
                    
                    // Format date with validation and fallback
                    let formattedDate = "N/A";
                    if (interview.createdAt) {
                        // Try different parsing strategies
                        const date = moment(interview.createdAt);
                        
                        // Check if we got a valid date
                        if (date.isValid()) {
                            formattedDate = date.format('MMM D, YYYY');
                        } else {
                            // Try parsing as ISO string
                            const isoDate = moment(interview.createdAt, moment.ISO_8601);
                            if (isoDate.isValid()) {
                                formattedDate = isoDate.format('MMM D, YYYY');
                            } else {
                                // Try parsing as timestamp number
                                const timestamp = parseInt(interview.createdAt);
                                if (!isNaN(timestamp)) {
                                    const timestampDate = moment(timestamp);
                                    if (timestampDate.isValid()) {
                                        formattedDate = timestampDate.format('MMM D, YYYY');
                                    }
                                }
                            }
                        }
                    }
                    
                    return {
                        ...interview,
                        status: isCompleted ? 'completed' : 'in_progress',
                        averageRating: averageRating,
                        questionCount: answers.length,
                        formattedDate: formattedDate
                    };
                })
            );

            setInterviews(interviewsWithStatus);
        } catch (error) {
            console.error('Error fetching interviews:', error);
            toast.error('Failed to load interviews');
        } finally {
            setLoading(false);
        }
    };

    // Apply all filters
    const filteredInterviews = interviews.filter(interview => {
        // Filter by status
        if (filter !== 'all' && interview.status !== filter) {
            return false;
        }
        
        // Filter by search term
        if (searchTerm && !interview.jobPosition.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !interview.jobDesc.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        
        // Filter by date range
        if (dateRange !== 'all') {
            const interviewDate = new Date(interview.createdAt);
            const today = new Date();
            
            if (dateRange === 'today') {
                return moment(interviewDate).isSame(today, 'day');
            } else if (dateRange === 'this_week') {
                return moment(interviewDate).isSame(today, 'week');
            } else if (dateRange === 'this_month') {
                return moment(interviewDate).isSame(today, 'month');
            }
        }
        
        return true;
    });

    // Sort the interviews
    const sortedInterviews = [...filteredInterviews].sort((a, b) => {
        if (sortBy === 'newest') {
            return new Date(b.createdAt) - new Date(a.createdAt);
        }
        if (sortBy === 'oldest') {
            return new Date(a.createdAt) - new Date(b.createdAt);
        }
        if (sortBy === 'highest_rated') {
            return b.averageRating - a.averageRating;
        }
        if (sortBy === 'lowest_rated') {
            return a.averageRating - b.averageRating;
        }
        return 0;
    });

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
                <Link href="/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Link>
            </div>

            <div className="mb-8 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Interview History</h1>
                <Button 
                    variant="outline" 
                    onClick={fetchInterviews}
                    className="text-sm"
                >
                    Refresh
                </Button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search by position or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Filters Row */}
            <div className="mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center text-sm text-gray-500">
                    <Filter className="w-4 h-4 mr-2" />
                    <span>Filters:</span>
                </div>
                
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Status</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                </select>

                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                </select>

                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest_rated">Highest Rated</option>
                    <option value="lowest_rated">Lowest Rated</option>
                </select>
                
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                        setFilter('all');
                        setSortBy('newest');
                        setSearchTerm('');
                        setDateRange('all');
                    }}
                    className="text-xs"
                >
                    Clear Filters
                </Button>
            </div>

            {/* Results summary */}
            <div className="mb-4">
                <p className="text-sm text-gray-500">
                    Showing {sortedInterviews.length} {sortedInterviews.length === 1 ? 'interview' : 'interviews'}
                </p>
            </div>

            {sortedInterviews.length === 0 ? (
                <Card className="bg-white">
                    <CardContent className="pt-6 text-center py-12">
                        <p className="text-gray-500">No interviews found matching your filters.</p>
                        {filter !== 'all' || searchTerm || dateRange !== 'all' ? (
                            <Button 
                                variant="link" 
                                onClick={() => {
                                    setFilter('all');
                                    setSortBy('newest');
                                    setSearchTerm('');
                                    setDateRange('all');
                                }}
                                className="mt-2"
                            >
                                Clear all filters
                            </Button>
                        ) : (
                            <Button
                                variant="link"
                                onClick={() => router.push('/dashboard')}
                                className="mt-2"
                            >
                                Create a new interview
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedInterviews.map((interview) => (
                        <Card key={interview.mockId} className="bg-white hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg font-semibold text-gray-900">
                                        {interview.jobPosition}
                                    </CardTitle>
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        interview.status === 'completed' 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {interview.status === 'completed' ? 'Completed' : 'In Progress'}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-sm text-gray-500 space-y-2">
                                    {/* Experience level */}
                                    <div className="flex items-center gap-1.5">
                                        <Briefcase className="w-4 h-4" />
                                        <span>{interview.jobExperience}</span>
                                    </div>
                                    
                                    {/* Date */}
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" />
                                        <span>{interview.formattedDate}</span>
                                    </div>
                                    
                                    {/* Questions count */}
                                    <div className="flex items-center gap-1.5">
                                        <MessageSquare className="w-4 h-4" />
                                        <span>{interview.questionCount} questions</span>
                                    </div>
                                    
                                    {/* Rating if completed */}
                                    {interview.status === 'completed' && interview.averageRating > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex items-center">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star 
                                                        key={i} 
                                                        className={`w-4 h-4 ${
                                                            i < Math.round(interview.averageRating) 
                                                                ? 'text-yellow-400 fill-yellow-400' 
                                                                : 'text-gray-300'
                                                        }`} 
                                                    />
                                                ))}
                                                <span className="ml-1 text-sm">
                                                    {interview.averageRating.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Job description preview */}
                                <p className="text-sm text-gray-600 line-clamp-2">
                                    {interview.jobDesc}
                                </p>
                                
                                <div className="pt-2 flex justify-between items-center">
                                    <Link 
                                        href={`/dashboard/interview/${interview.mockId}/feedback?mockId=${interview.mockId}`}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                                    >
                                        View Details
                                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </Link>
                                    
                                    {interview.status !== 'completed' && (
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="flex items-center gap-1 text-xs"
                                            onClick={() => router.push(`/dashboard/interview/${interview.mockId}/start?mockId=${interview.mockId}`)}
                                        >
                                            <Play className="w-3 h-3" />
                                            Continue
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

export default HistoryPage;