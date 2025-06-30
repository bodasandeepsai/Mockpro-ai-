"use client"
import { db } from '@/utils/db';
import { MockInterview, UserAnswer } from '@/utils/schema';
import { useUser } from '@clerk/nextjs'
import { desc, eq, inArray } from 'drizzle-orm';
import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Clock, 
    MessageSquare, 
    Play, 
    Star, 
    Calendar, 
    Briefcase, 
    CheckCircle2,
    XCircle,
    Clock as ClockIcon,
    TrendingUp,
    Eye,
    BarChart3,
    Plus
} from "lucide-react";
import moment from 'moment';
import Link from 'next/link';

function InterviewList() {
    const { user } = useUser();
    const [interviewList, setInterviewList] = useState([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        const GetInterviewList = async () => {
            if (!user?.primaryEmailAddress?.emailAddress) return;

            try {
                setLoading(true);

                // Get all interviews for the user
                const interviewData = await db.select()
        .from(MockInterview)
                    .where(eq(MockInterview.createdBy, user.primaryEmailAddress.emailAddress))
        .orderBy(desc(MockInterview.id));

                if (interviewData.length > 0) {
                    // Get all answers for these interviews
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

                    setInterviewList(interviewsWithDetails);
                } else {
                    setInterviewList([]);
                }
            } catch (error) {
                console.error('Error fetching interviews:', error);
            } finally {
                setLoading(false);
            }
        };

        GetInterviewList();
    }, [user]);

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
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="h-24 bg-gray-200 rounded-lg"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (interviewList.length === 0) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <BarChart3 className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews yet</h3>
                    <p className="text-gray-600 mb-6">
                        Start your first mock interview to see your progress here.
                    </p>
                    <Link href="/dashboard/interview">
                        <Button className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Start New Interview
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

  return (
        <div className="space-y-4">
            {interviewList.slice(0, 5).map((interview) => (
                <Card key={interview.mockId} className="hover:shadow-lg transition-shadow duration-200">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-3">
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

                                <div className="space-y-3">
    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                            {interview.jobPosition}
                                        </h3>
                                        <p className="text-sm text-gray-600 flex items-center gap-1">
                                            <Briefcase className="w-4 h-4" />
                                            {interview.jobExperience} years experience
                                        </p>
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
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default InterviewList;
