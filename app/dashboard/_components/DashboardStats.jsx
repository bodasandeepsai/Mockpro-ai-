"use client"
import { Video, Clock, Star, Users } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { db, getDb } from '@/utils/db'
import { MockInterview, UserAnswer } from '@/utils/schema'
import { eq, sql, count } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoaderCircle } from '@/components/ui/loader'

export default function DashboardStats() {
    const { user } = useUser();
    const [stats, setStats] = useState({
        totalInterviews: 0,
        completedInterviews: 0,
        totalQuestions: 0,
        answeredQuestions: 0
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
                const userEmail = user.primaryEmailAddress.emailAddress;
                
                // Use Promise.all to run queries in parallel
                const [interviews, userAnswers, answerCountResult] = await Promise.all([
                    // Get all interviews with minimal data needed
                    dbInstance.select({
                        mockId: MockInterview.mockId,
                        jsonMockResp: MockInterview.jsonMockResp
                    })
                    .from(MockInterview)
                    .where(eq(MockInterview.createdBy, userEmail)),
                    
                    // Get unique mockIds for completed interviews
                    dbInstance.select({
                        mockIdref: UserAnswer.mockIdref
                    })
                    .from(UserAnswer)
                    .where(eq(UserAnswer.userEmail, userEmail))
                    .groupBy(UserAnswer.mockIdref),
                    
                    // Get total answered questions count with a single aggregation query
                    dbInstance.select({
                        count: count()
                    })
                    .from(UserAnswer)
                    .where(eq(UserAnswer.userEmail, userEmail))
                ]);
                
                // Efficiently calculate total interviews
                const totalInterviews = interviews.length;
                
                // Calculate completed interviews (that have answers)
                const completedInterviews = userAnswers.length;
                
                // Calculate total questions with minimal JSON parsing
                let totalQuestions = 0;
                for (const interview of interviews) {
                    try {
                        // Only parse the JSON once per interview
                        const questionsData = JSON.parse(interview.jsonMockResp || '[]');
                        totalQuestions += Array.isArray(questionsData) ? questionsData.length + 1 : 1; // +1 for coding question
                    } catch (e) {
                        console.error('Error parsing questions JSON:', e);
                        totalQuestions += 1; // Assume at least one question if parsing fails
                    }
                }
                
                // Get answered questions count from the aggregation result
                const answeredQuestions = answerCountResult[0]?.count || 0;

                setStats({
                    totalInterviews,
                    completedInterviews,
                    totalQuestions,
                    answeredQuestions
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
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center space-x-2">
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                <span>Loading statistics</span>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
                    <Video className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalInterviews}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed Interviews</CardTitle>
                    <Clock className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.completedInterviews}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
                    <Star className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalQuestions}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <Users className="h-4 w-4 text-purple-500" />
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