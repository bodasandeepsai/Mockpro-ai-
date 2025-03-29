"use client"
import { Video, Clock, Star, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { db } from '@/utils/db'
import { MockInterview, UserAnswer } from '@/utils/schema'
import { eq, sql } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardStats() {
    const { user } = useUser();
    const [stats, setStats] = useState({
        totalInterviews: 0,
        completedInterviews: 0,
        totalQuestions: 0,
        answeredQuestions: 0
    });

    useEffect(() => {
        const getStats = async () => {
            if (!user?.primaryEmailAddress?.emailAddress) return;

            try {
                // Get total interviews
                const interviews = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.createdBy, user.primaryEmailAddress.emailAddress));

                // Get user answers
                const userAnswers = await db.select()
                    .from(UserAnswer)
                    .where(eq(UserAnswer.userEmail, user.primaryEmailAddress.emailAddress));

                // Calculate stats
                const totalInterviews = interviews.length;
                const completedInterviews = new Set(userAnswers.map(a => a.mockIdref)).size;
                const totalQuestions = interviews.reduce((acc, interview) => {
                    const questions = JSON.parse(interview.jsonMockResp);
                    return acc + questions.length + 1; // +1 for coding question
                }, 0);
                const answeredQuestions = userAnswers.length;

                setStats({
                    totalInterviews,
                    completedInterviews,
                    totalQuestions,
                    answeredQuestions
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        getStats();
    }, [user]);

    const completionRate = stats.totalQuestions > 0
        ? Math.round((stats.answeredQuestions / stats.totalQuestions) * 100)
        : 0;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalInterviews}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed Interviews</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.completedInterviews}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalQuestions}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{completionRate}%</div>
                    <p className="text-xs text-gray-500 mt-1">
                        {stats.answeredQuestions} of {stats.totalQuestions} questions answered
                    </p>
                </CardContent>
            </Card>
        </div>
    );
} 