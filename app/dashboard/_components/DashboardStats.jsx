"use client"
import { Video, CheckCircle2, Star, ListChecks, ClipboardCheck } from 'lucide-react'

import { useEffect, useState, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { db, getDb } from '@/utils/db'
import { MockInterview, UserAnswer } from '@/utils/schema'
import { eq, inArray } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'

export default function DashboardStats() {
    const { user } = useUser();
    const [stats, setStats] = useState({
        totalInterviews: 0,
        completedInterviews: 0,
        totalQuestions: 0,
        answeredQuestions: 0,
        averageRating: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Use the optimized database connection
    const dbInstance = useMemo(() => getDb(), []);

    useEffect(() => {
        const getStats = async () => {
            if (!user?.primaryEmailAddress?.emailAddress) return;
            
            setLoading(true);
            setError(null);

            try {
                // Get all interviews for the user
                const interviews = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.createdBy, user.primaryEmailAddress.emailAddress));

                if (interviews.length === 0) {
                    setStats({
                        totalInterviews: 0,
                        completedInterviews: 0,
                        totalQuestions: 0,
                        answeredQuestions: 0,
                        averageRating: 0
                    });
                    setLoading(false);
                    return;
                }

                // Get all answers for these interviews
                const mockIds = interviews.map(interview => interview.mockId);
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

                // Process interviews and calculate stats
                let completedCount = 0;
                let totalQuestionsCount = 0;
                let answeredQuestionsCount = allAnswers.length;
                let totalRating = 0;
                let ratedAnswersCount = 0;

                interviews.forEach(interview => {
                    const answers = answersByMockId[interview.mockId] || [];
                    const completedAnswers = answers.filter(answer => answer.feedback);
                    const totalQuestions = answers.length;
                    
                    // Count questions from interview JSON
                    try {
                        if (interview.jsonMockResp) {
                            const questions = JSON.parse(interview.jsonMockResp);
                            if (Array.isArray(questions)) {
                                totalQuestionsCount += questions.length;
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing interview questions:', error);
                    }

                    // coding questions are no longer part of interviews; count only JSON questions

                    // Determine interview status
                    if (completedAnswers.length > 0 && completedAnswers.length === totalQuestions) {
                        completedCount++;
                    }

                    // Calculate ratings
                    completedAnswers.forEach(answer => {
                        const rating = parseInt(answer.rating) || 0;
                        if (rating > 0) {
                            totalRating += rating;
                            ratedAnswersCount++;
                        }
                    });
                });

                const averageRating = ratedAnswersCount > 0 ? (totalRating / ratedAnswersCount).toFixed(1) : 0;

                setStats({
                    totalInterviews: interviews.length,
                    completedInterviews: completedCount,
                    totalQuestions: totalQuestionsCount,
                    answeredQuestions: answeredQuestionsCount,
                    averageRating: parseFloat(averageRating)
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
                setError('Failed to load dashboard statistics');
            } finally {
                setLoading(false);
            }
        };

        if (user?.primaryEmailAddress?.emailAddress) {
            getStats();
        }
    }, [user, dbInstance]);

    // Memoize the completion rate calculation to avoid recalculating on every render
    const completionRate = useMemo(() => {
        return stats.totalQuestions > 0
            ? Math.round((stats.answeredQuestions / stats.totalQuestions) * 100)
            : 0;
    }, [stats.totalQuestions, stats.answeredQuestions]);

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((_, index) => (
                    <Card key={index} className="opacity-60">
                        <CardContent>
                            <div className="flex items-center space-x-2">
                                Loading statistics...
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md">
                {error}
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
            {/* Total Interviews */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-600">Total Interviews</p>
                            <p className="text-2xl font-bold text-blue-900">{stats.totalInterviews}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-full">
                            <Video className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Completed Interviews */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-green-600">Completed</p>
                            <p className="text-2xl font-bold text-green-900">{stats.completedInterviews}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-full">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Total Questions */}
            <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-purple-600">Total Questions</p>
                            <p className="text-2xl font-bold text-purple-900">{stats.totalQuestions}</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-full">
                            <ListChecks className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Answered Questions */}
            <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-yellow-600">Answered</p>
                            <p className="text-2xl font-bold text-yellow-900">{stats.answeredQuestions}</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-full">
                            <ClipboardCheck className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Average Rating */}
            <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-orange-600">Avg Rating</p>
                            <p className="text-2xl font-bold text-orange-900">{stats.averageRating}/5</p>
                        </div>
                        <div className="p-3 bg-orange-100 rounded-full">
                            <Star className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>

                </CardContent>
            </Card>
            {/* Completion Rate */}
            <Card className="bg-gradient-to-r from-pink-50 to-pink-100 border-pink-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-pink-600">Completion Rate</p>
                            <p className="text-2xl font-bold text-pink-900">{completionRate}%</p>
                        </div>
                        <div className="p-3 bg-pink-100 rounded-full">
                            <CheckCircle2 className="w-6 h-6 text-pink-600" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}