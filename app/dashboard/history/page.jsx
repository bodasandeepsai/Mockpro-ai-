"use client";
import React, { useEffect, useState } from 'react';
import { db } from '@/utils/db';
import { MockInterview, UserAnswer } from '@/utils/schema';
import { useUser } from '@clerk/nextjs';
import { eq, desc, inArray } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    Clock, 
    MessageSquare, 
    Play, 
    Star, 
    Calendar, 
    Briefcase, 
    Filter, 
    Search,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Clock as ClockIcon,
    TrendingUp,
    Eye,
    BarChart3
} from "lucide-react";
import moment from 'moment';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

function HistoryPage() {
    const { user } = useUser();
    const router = useRouter();
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [dateFilter, setDateFilter] = useState('all');

    // Helper function to parse DD-MM-YYYY format dates
    const parseCustomDate = (dateString) => {
        if (!dateString) return null;
        
        try {
            // Handle DD-MM-YYYY format
            if (dateString.includes('-')) {
                const parts = dateString.split('-');
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
            }
            
            // Fallback to standard date parsing
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            console.error('Error parsing date:', dateString, error);
            return null;
        }
    };

    // Helper function to format date for display
    const formatDateForDisplay = (dateString) => {
        const date = parseCustomDate(dateString);
        if (!date) return 'Invalid Date';
        return moment(date).format('MMM DD, YYYY');
    };

    // Helper function to get days difference
    const getDaysDifference = (dateString) => {
        const date = parseCustomDate(dateString);
        if (!date) return Infinity;
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    useEffect(() => {
        const fetchInterviews = async () => {
            try {
                if (!user?.primaryEmailAddress?.emailAddress) return;

                // Fetch all interviews for the user
                const interviewData = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.createdBy, user.primaryEmailAddress.emailAddress))
                    .orderBy(desc(MockInterview.id));

                if (interviewData.length > 0) {
                    // Fetch all answers for all interviews in a single query
                    const mockIds = interviewData.map(interview => interview.mockId);
                    const allAnswers = await db.select()
                        .from(UserAnswer)
                        .where(inArray(UserAnswer.mockIdref, mockIds));

                    // Group answers by mockId for efficient lookup
                    const answersByMockId = allAnswers.reduce((acc, answer) => {
                        if (!acc[answer.mockIdref]) {
                            acc[answer.mockIdref] = [];
                        }
                        acc[answer.mockIdref].push(answer);
                        return acc;
                    }, {});

                    // Process interviews with their answers
                    const interviewsWithDetails = interviewData.map(interview => {
                        const answers = answersByMockId[interview.mockId] || [];
                        const completedAnswers = answers.filter(answer => answer.feedback);
                        const totalQuestions = answers.length;
                        const completedQuestions = completedAnswers.length;
                        
                        // Calculate average rating
                        const ratings = completedAnswers
                            .map(answer => parseInt(answer.rating) || 0)
                            .filter(rating => rating > 0);
                        const averageRating = ratings.length > 0 
                            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
                            : 0;

                        // Determine status
                        let status = 'pending';
                        if (completedQuestions > 0) {
                            status = completedQuestions === totalQuestions ? 'completed' : 'in_progress';
                        }

                        return {
                        ...interview,
                            status,
                            totalQuestions,
                            completedQuestions,
                            averageRating: parseFloat(averageRating),
                            lastActivity: answers.length > 0 
                                ? Math.max(...answers.map(a => {
                                    const answerDate = parseCustomDate(a.createdAt);
                                    return answerDate ? answerDate.getTime() : 0;
                                }))
                                : (() => {
                                    const interviewDate = parseCustomDate(interview.createdAt);
                                    return interviewDate ? interviewDate.getTime() : 0;
                                })()
                        };
                    });

                    setInterviews(interviewsWithDetails);
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

    // Filter and sort interviews
    const filteredAndSortedInterviews = interviews
        .filter(interview => {
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    interview.jobPosition.toLowerCase().includes(searchLower) ||
                    interview.jobDesc.toLowerCase().includes(searchLower) ||
                    interview.jobExperience.toLowerCase().includes(searchLower)
                );
            }
            return true;
        })
        .filter(interview => {
            // Status filter
            if (statusFilter === 'completed') return interview.status === 'completed';
            if (statusFilter === 'in_progress') return interview.status === 'in_progress';
            if (statusFilter === 'pending') return interview.status === 'pending';
        return true;
        })
        .filter(interview => {
            // Date filter
            const daysDiff = getDaysDifference(interview.createdAt);
            
            if (dateFilter === 'today') return daysDiff === 0;
            if (dateFilter === 'week') return daysDiff <= 7;
            if (dateFilter === 'month') return daysDiff <= 30;
            return true;
        })
        .sort((a, b) => {
            // Sort by
            if (sortBy === 'newest') {
                const dateA = parseCustomDate(a.createdAt);
                const dateB = parseCustomDate(b.createdAt);
                return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
            }
            if (sortBy === 'oldest') {
                const dateA = parseCustomDate(a.createdAt);
                const dateB = parseCustomDate(b.createdAt);
                return (dateA ? dateA.getTime() : 0) - (dateB ? dateB.getTime() : 0);
            }
            if (sortBy === 'rating') return b.averageRating - a.averageRating;
            if (sortBy === 'recent_activity') return b.lastActivity - a.lastActivity;
        return 0;
    });

    const getStatusBadge = (status, completedQuestions, totalQuestions) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
            case 'in_progress':
                const progress = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;
                return (
                    <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            In Progress ({completedQuestions}/{totalQuestions})
                        </Badge>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                );
            case 'pending':
                return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Pending</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Unknown</Badge>;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-5 h-5 text-green-600" />;
            case 'in_progress':
                return <ClockIcon className="w-5 h-5 text-blue-600" />;
            case 'pending':
                return <XCircle className="w-5 h-5 text-gray-600" />;
            default:
                return <ClockIcon className="w-5 h-5 text-gray-600" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header Skeleton */}
                    <div className="mb-8">
                        <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="h-8 w-64 bg-gray-200 rounded mb-2"></div>
                                <div className="h-4 w-96 bg-gray-200 rounded"></div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="text-right">
                                    <div className="h-3 w-20 bg-gray-200 rounded mb-1"></div>
                                    <div className="h-6 w-8 bg-gray-200 rounded"></div>
                                </div>
                                <div className="text-right">
                                    <div className="h-3 w-20 bg-gray-200 rounded mb-1"></div>
                                    <div className="h-6 w-8 bg-gray-200 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters Skeleton */}
                    <div className="mb-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-10 bg-gray-200 rounded"></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Cards Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-lg shadow p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="h-4 w-20 bg-gray-200 rounded"></div>
                                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                                </div>
                                <div className="space-y-3">
                                    <div className="h-5 w-48 bg-gray-200 rounded"></div>
                                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                                    <div className="h-3 w-full bg-gray-200 rounded"></div>
                                    <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                                    <div className="flex gap-2 pt-2">
                                        <div className="h-8 flex-1 bg-gray-200 rounded"></div>
                                        <div className="h-8 flex-1 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
                {/* Header */}
            <div className="mb-8">
                   
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Interview History</h1>
                            <p className="mt-2 text-gray-600">
                                Track your mock interview progress and performance
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total Interviews</p>
                                    <p className="text-2xl font-bold text-gray-900">{interviews.length}</p>
                                </div>
                                <div className="p-2 bg-blue-100 rounded-full">
                                    <BarChart3 className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Completed</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {interviews.filter(i => i.status === 'completed').length}
                                    </p>
                                </div>
                                <div className="p-2 bg-green-100 rounded-full">
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">In Progress</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {interviews.filter(i => i.status === 'in_progress').length}
                                    </p>
                                </div>
                                <div className="p-2 bg-blue-100 rounded-full">
                                    <ClockIcon className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Avg Rating</p>
                                    <p className="text-2xl font-bold text-yellow-600">
                                        {(() => {
                                            const completedInterviews = interviews.filter(i => i.averageRating > 0);
                                            if (completedInterviews.length === 0) return '0.0';
                                            const avg = completedInterviews.reduce((sum, i) => sum + i.averageRating, 0) / completedInterviews.length;
                                            return avg.toFixed(1);
                                        })()}
                                    </p>
                                </div>
                                <div className="p-2 bg-yellow-100 rounded-full">
                                    <Star className="w-6 h-6 text-yellow-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
            </div>

                {/* Filters Section */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="Search interviews..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
            </div>

                            {/* Status Filter */}
                <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                                <option value="pending">Pending</option>
                            </select>

                            {/* Date Filter */}
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                </select>

                            {/* Sort By */}
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                                <option value="rating">Highest Rating</option>
                                <option value="recent_activity">Recent Activity</option>
                </select>

                            {/* Clear Filters */}
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearchTerm('');
                                    setStatusFilter('all');
                                    setDateFilter('all');
                                    setSortBy('newest');
                                }}
                                className="flex items-center gap-2"
                            >
                                <XCircle className="w-4 h-4" />
                                Clear Filters
                            </Button>
            </div>
                    </CardContent>
                </Card>

                {/* Results Count */}
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Showing {filteredAndSortedInterviews.length} of {interviews.length} interviews
                    </p>
                </div>

                {/* Interviews Grid */}
                {filteredAndSortedInterviews.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <BarChart3 className="w-12 h-12 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews found</h3>
                            <p className="text-gray-600 mb-6">
                                {searchTerm || statusFilter !== 'all' || dateFilter !== 'all' 
                                    ? 'Try adjusting your filters or search terms.'
                                    : 'Start your first mock interview to see your history here.'
                                }
                            </p>
                            {!searchTerm && statusFilter === 'all' && dateFilter === 'all' && (
                                <Link href="/dashboard/interview">
                                    <Button className="flex items-center gap-2">
                                        <Play className="w-4 h-4" />
                                        Start New Interview
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAndSortedInterviews.map((interview) => (
                            <Card key={interview.mockId} className="hover:shadow-lg transition-shadow duration-200">
                                <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(interview.status)}
                                            {getStatusBadge(interview.status, interview.completedQuestions, interview.totalQuestions)}
                                        </div>
                                        <div className="text-right">
                                            {interview.averageRating > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                                    <span className="text-sm font-medium">{interview.averageRating}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                
                                <CardContent>
                                    <div className="space-y-4">
                                <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                        {interview.jobPosition}
                                    </h3>
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                                <Briefcase className="w-4 h-4" />
                                                {interview.jobExperience} years experience
                                            </p>
                                        </div>

                                        <div className="text-sm text-gray-600 overflow-hidden" style={{ 
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        }}>
                                            {interview.jobDesc}
                                        </div>

                                        <div className="flex items-center justify-between text-sm text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {formatDateForDisplay(interview.createdAt)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MessageSquare className="w-4 h-4" />
                                                {interview.completedQuestions}/{interview.totalQuestions} questions
                                </div>
                            </div>

                                        {interview.status === 'completed' && interview.lastActivity && (
                                            <div className="text-xs text-green-600 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Completed {moment(interview.lastActivity).format('MMM DD, YYYY')}
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-2">
                                            <Link 
                                                href={`/dashboard/interview/${interview.mockId}`}
                                                className="flex-1"
                                            >
                                                <Button variant="outline" size="sm" className="w-full">
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    View Details
                                                </Button>
                                            </Link>
                                            
                                            {interview.status === 'completed' && (
                                <Link 
                                    href={`/dashboard/interview/${interview.mockId}/feedback?mockId=${interview.mockId}`}
                                                    className="flex-1"
                                                >
                                                    <Button size="sm" className="w-full">
                                                        <TrendingUp className="w-4 h-4 mr-1" />
                                                        Feedback
                                                    </Button>
                                                </Link>
                                            )}
                                            
                                            {interview.status !== 'completed' && (
                                                <Link 
                                                    href={`/dashboard/interview/${interview.mockId}/start?mockId=${interview.mockId}`}
                                                    className="flex-1"
                                                >
                                                    <Button size="sm" className="w-full">
                                                        <Play className="w-4 h-4 mr-1" />
                                                        Continue
                                                    </Button>
                                </Link>
                                            )}
                            </div>
                        </div>
                                </CardContent>
                            </Card>
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}

export default HistoryPage; 