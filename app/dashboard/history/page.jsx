"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { db, getDb } from '@/utils/db';
import { MockInterview, UserAnswer } from '@/utils/schema';
import { useUser } from '@clerk/nextjs';
import { eq, desc, inArray } from 'drizzle-orm';
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
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 10;

    const dbInstance = useMemo(() => getDb(), []);

    const fetchInterviews = useCallback(async (isInitial = false) => {
        try {
            if (!user?.primaryEmailAddress?.emailAddress) return;
            
            if (isInitial) {
                setLoading(true);
                setPage(1);
                setInterviews([]);
            }

            const userEmail = user.primaryEmailAddress.emailAddress;
            
            const startIndex = isInitial ? 0 : (page - 1) * ITEMS_PER_PAGE;
            
            const interviewData = await dbInstance.select()
                .from(MockInterview)
                .where(eq(MockInterview.createdBy, userEmail))
                .orderBy(desc(MockInterview.createdAt))
                .limit(ITEMS_PER_PAGE + 1) 
                .offset(startIndex);
            
            const hasMoreItems = interviewData.length > ITEMS_PER_PAGE;
            if (hasMoreItems) {
                interviewData.pop(); 
            }
            setHasMore(hasMoreItems);
            
            if (interviewData.length === 0) {
                setLoading(false);
                if (isInitial) {
                    setInterviews([]);
                }
                return;
            }
            
            const mockIds = interviewData.map(interview => interview.mockId);
            
            const allAnswers = await dbInstance.select()
                .from(UserAnswer)
                .where(inArray(UserAnswer.mockIdref, mockIds));
            
            const answersByMockId = {};
            allAnswers.forEach(answer => {
                if (!answersByMockId[answer.mockIdref]) {
                    answersByMockId[answer.mockIdref] = [];
                }
                answersByMockId[answer.mockIdref].push(answer);
            });
            
            const processedInterviews = interviewData.map(interview => {
                const answers = answersByMockId[interview.mockId] || [];
                
                const hasAnswers = answers.length > 0;
                const isCompleted = answers.some(answer => answer.feedback);
                
                let averageRating = 0;
                if (hasAnswers) {
                    const validRatings = answers
                        .map(answer => {
                            if (!answer.rating) return 0;
                            const match = answer.rating.match(/^(\d+)/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(rating => rating > 0);
                        
                    if (validRatings.length > 0) {
                        averageRating = validRatings.reduce((acc, curr) => acc + curr, 0) / validRatings.length;
                    }
                }
                
                let formattedDate = "N/A";
                if (interview.createdAt) {
                    const date = moment(interview.createdAt);
                    formattedDate = date.isValid() ? date.format('MMM D, YYYY') : "N/A";
                }
                
                let questionCount = 0;
                try {
                    const questions = JSON.parse(interview.jsonMockResp || '[]');
                    questionCount = Array.isArray(questions) ? questions.length : 0;
                } catch (err) {
                    console.error("Error parsing questions:", err);
                }
                
                return {
                    ...interview,
                    status: isCompleted ? 'completed' : (hasAnswers ? 'in-progress' : 'not-started'),
                    averageRating,
                    formattedDate,
                    questionCount: questionCount + 1, 
                };
            });

            if (isInitial) {
                setInterviews(processedInterviews);
            } else {
                setInterviews(prev => [...prev, ...processedInterviews]);
            }
        } catch (error) {
            console.error("Error fetching interviews:", error);
            toast.error("Failed to load interview history");
        } finally {
            setLoading(false);
        }
    }, [user, page, dbInstance]);
    
    useEffect(() => {
        if (user) {
            fetchInterviews(true);
        }
    }, [user, fetchInterviews]);
    
    const loadMoreInterviews = () => {
        if (!loading && hasMore) {
            setPage(prev => prev + 1);
            fetchInterviews();
        }
    };
    
    const filteredInterviews = useMemo(() => {
        let filtered = [...interviews];
        
        if (filter !== 'all') {
            filtered = filtered.filter(interview => interview.status === filter);
        }
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(interview => 
                interview.jobPosition.toLowerCase().includes(term) ||
                interview.jobDesc.toLowerCase().includes(term)
            );
        }
        
        if (dateRange !== 'all') {
            const now = moment();
            filtered = filtered.filter(interview => {
                const createdDate = moment(interview.createdAt);
                if (!createdDate.isValid()) return false;
                
                switch (dateRange) {
                    case 'today':
                        return createdDate.isSame(now, 'day');
                    case 'week':
                        return createdDate.isAfter(now.clone().subtract(1, 'week'));
                    case 'month':
                        return createdDate.isAfter(now.clone().subtract(1, 'month'));
                    default:
                        return true;
                }
            });
        }
        
        if (sortBy === 'newest') {
            filtered.sort((a, b) => moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf());
        } else if (sortBy === 'oldest') {
            filtered.sort((a, b) => moment(a.createdAt).valueOf() - moment(b.createdAt).valueOf());
        } else if (sortBy === 'rating') {
            filtered.sort((a, b) => b.averageRating - a.averageRating);
        }
        
        return filtered;
    }, [interviews, filter, searchTerm, dateRange, sortBy]);
    
    const InterviewCard = useCallback(({ interview }) => (
        <Card key={interview.mockId} className="overflow-hidden bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-5">
                <div className="mb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-blue-600" />
                            <h3 className="font-medium text-gray-900">{interview.jobPosition}</h3>
                        </div>
                        
                        <div>
                            {interview.status === 'completed' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Completed
                                </span>
                            ) : interview.status === 'in-progress' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    In Progress
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Not Started
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{interview.formattedDate}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" />
                        <span>{interview.questionCount} questions</span>
                    </div>
                    
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
    ), [router]);
    
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 px-4 md:px-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        className="p-0 h-8 w-8"
                        onClick={() => router.push('/dashboard')}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-900">Interview History</h1>
                </div>
            </div>
            
            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Status Filter */}
                        <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                                <Filter className="h-4 w-4 mr-1.5" />
                                Status
                            </label>
                            <select 
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="all">All Interviews</option>
                                <option value="completed">Completed</option>
                                <option value="in-progress">In Progress</option>
                                <option value="not-started">Not Started</option>
                            </select>
                        </div>
                        
                        {/* Sort Filter */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Sort By</label>
                            <select 
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="rating">Highest Rating</option>
                            </select>
                        </div>
                        
                        {/* Date Range Filter */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Date Range</label>
                            <select 
                                value={dateRange}
                                onChange={e => setDateRange(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>
                        
                        {/* Search */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Search</label>
                            <input 
                                type="text"
                                placeholder="Search job position..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Results summary */}
            <div className="mb-4">
                <p className="text-sm text-gray-500">
                    Showing {filteredInterviews.length} {filteredInterviews.length === 1 ? 'interview' : 'interviews'}
                </p>
            </div>

            {filteredInterviews.length === 0 ? (
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
                    {filteredInterviews.map((interview) => (
                        <InterviewCard key={interview.mockId} interview={interview} />
                    ))}
                    {hasMore && (
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={loadMoreInterviews}
                            className="text-xs"
                        >
                            Load More
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

export default HistoryPage;