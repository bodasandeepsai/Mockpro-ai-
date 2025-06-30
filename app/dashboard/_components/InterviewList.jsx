"use client"
import { db } from '@/utils/db';
import { MockInterview, UserAnswer } from '@/utils/schema';
import { useUser } from '@clerk/nextjs'
import { desc, eq, inArray } from 'drizzle-orm';
import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import InterviewItemCard from './InterviewItemCard';
import { LoaderCircle } from 'lucide-react';
import moment from 'moment';
import Link from 'next/link';

function InterviewList() {
    const { user } = useUser();
    const [interviewList, setInterviewList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Helper function to parse DD-MM-YYYY format dates
    const parseCustomDate = (dateString) => {
        if (!dateString) return null;
        try {
            if (dateString.includes('-')) {
                const parts = dateString.split('-');
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
            }
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
        const fetchInterviews = async () => {
            if (!user?.primaryEmailAddress?.emailAddress) return;
            try {
                setLoading(true);
                // Get all interviews for this user without limit
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
                    setError(null);
                } else {
                    setInterviewList([]);
                }
            } catch (err) {
                console.error("Error fetching interviews:", err);
                setError("Failed to load interviews. Please refresh and try again.");
            } finally {
                setLoading(false);
            }
        };
        if (user) {
            fetchInterviews();
        }
    }, [user]);

    return (
        <div>
            {error && (
                <div className="text-red-500 my-3">{error}</div>
            )}
            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <LoaderCircle className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : interviewList.length === 0 ? (
                <div className="text-gray-500 my-5 text-center p-8 border border-dashed rounded-md">
                    No interviews found. Create a new interview to get started!
                </div>
            ) : (
                <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 my-3 max-h-[420px] overflow-y-auto pr-2'>
                    {interviewList.slice(0, 5).map((interview, index) => (
                        <InterviewItemCard 
                            interview={interview}
                            key={`interview-${interview.mockId}-${index}`} 
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default InterviewList;
