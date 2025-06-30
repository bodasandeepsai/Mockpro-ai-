"use client";
import { useEffect, useState, use } from "react";
import { db } from "@/utils/db";
import { UserAnswer, MockInterview } from "@/utils/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    ArrowLeft, 
    Star, 
    CheckCircle2, 
    XCircle, 
    AlertCircle,
    Clock,
    MessageSquare,
    TrendingUp,
    BarChart3,
    Code,
    FileText
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import moment from 'moment';

export default function Feedback({ params }) {
    const { user } = useUser();
    const [answers, setAnswers] = useState([]);
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const mockId = searchParams.get('mockId');

    // Unwrap params using React.use() for Next.js 15+
    const unwrappedParams = use(params);
    const interviewId = unwrappedParams?.interviewId;

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
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                if (!mockId) {
                    setError('Interview ID not found');
                    toast.error('Interview ID not found');
                    return;
                }

                // Fetch interview details
                const interviewData = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.mockId, mockId));

                if (interviewData.length === 0) {
                    setError('Interview not found');
                    toast.error('Interview not found');
                    return;
                }

                const interviewInfo = interviewData[0];
                
                // Parse the interview questions if available
                let questions = [];
                try {
                    if (interviewInfo.jsonMockResp) {
                        questions = JSON.parse(interviewInfo.jsonMockResp);
                    }
                } catch (parseError) {
                    console.error('Error parsing interview questions:', parseError);
                }

                setInterview({
                    ...interviewInfo,
                    questions: Array.isArray(questions) ? questions : []
                });

                // Fetch user answers
                const userAnswers = await db.select()
                    .from(UserAnswer)
                    .where(eq(UserAnswer.mockIdref, mockId))
                    .orderBy(UserAnswer.id);

                // Process and validate answers
                const processedAnswers = userAnswers.map(answer => {
                    let testCases = [];
                    try {
                        if (answer.testCases) {
                            testCases = JSON.parse(answer.testCases);
                        }
                    } catch (parseError) {
                        console.error('Error parsing test cases:', parseError);
                    }

                    return {
                        ...answer,
                        testCases: Array.isArray(testCases) ? testCases : [],
                        rating: parseInt(answer.rating) || 0
                    };
                });

                setAnswers(processedAnswers);

                if (processedAnswers.length === 0) {
                    toast.info('No answers found for this interview');
                }

            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Failed to load interview data');
                toast.error('Failed to load interview data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [mockId]);

    const calculateOverallRating = () => {
        if (!answers.length) return 0;
        const validRatings = answers.filter(answer => answer.rating > 0);
        if (validRatings.length === 0) return 0;
        
        const total = validRatings.reduce((acc, answer) => acc + answer.rating, 0);
        return Math.round(total / validRatings.length);
    };

    const getPerformanceLevel = (rating) => {
        if (rating >= 4) return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
        if (rating >= 3) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
        if (rating >= 2) return { level: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-100' };
        return { level: 'Needs Improvement', color: 'text-red-600', bg: 'bg-red-100' };
    };

    const overallRating = calculateOverallRating();
    const performance = getPerformanceLevel(overallRating);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading interview feedback...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Feedback</h2>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <div className="flex gap-4 justify-center">
                            <Button onClick={() => window.location.reload()}>
                                Try Again
                            </Button>
                            <Link href="/dashboard">
                                <Button variant="outline">
                                    Back to Dashboard
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!interview) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Interview Not Found</h2>
                        <p className="text-gray-600 mb-6">The interview you're looking for doesn't exist or has been removed.</p>
                        <Link href="/dashboard">
                            <Button>
                                Back to Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <Link 
                                href="/dashboard" 
                                className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Dashboard
                            </Link>
                            <h1 className="text-3xl font-bold text-gray-900">Interview Feedback</h1>
                            <p className="text-gray-600 mt-2">Review your performance and learn from the feedback</p>
                        </div>
                    </div>
                </div>

                {/* Interview Info Card */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{interview.jobPosition}</h3>
                                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                    <Clock className="w-4 h-4" />
                                    {interview.jobExperience} years experience
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Created</p>
                                <p className="font-medium">{formatDateForDisplay(interview.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Questions Answered</p>
                                <p className="font-medium">{answers.length} questions</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Overall Performance Card */}
                <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold text-gray-900">Overall Performance</h3>
                                <p className="text-sm text-gray-600">Based on {answers.filter(a => a.rating > 0).length} rated questions</p>
                                <Badge className={`${performance.bg} ${performance.color} hover:${performance.bg}`}>
                                    {performance.level}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-blue-600">{overallRating}/5</div>
                                    <div className="flex items-center gap-1 mt-2">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`w-5 h-5 ${
                                                    i < overallRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Questions Feedback */}
                {answers.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Answers Found</h3>
                            <p className="text-gray-600 mb-6">
                                No answers have been recorded for this interview yet.
                            </p>
                            <Link href={`/dashboard/interview/${interview.mockId}/start?mockId=${interview.mockId}`}>
                                <Button className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Start Interview
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {answers.map((answer, index) => {
                            const answerPerformance = getPerformanceLevel(answer.rating);
                            
                            return (
                                <Card key={answer.id || index} className="border-l-4 border-blue-500">
                                    <CardContent className="p-6">
                                        <div className="space-y-4">
                                            {/* Question Header */}
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-lg font-medium text-gray-900">
                                                            Question {index + 1}
                                                        </h3>
                                                        {answer.isCodingQuestion && (
                                                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                                                <Code className="w-3 h-3 mr-1" />
                                                                Coding
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-600">{answer.question}</p>
                                                </div>
                                                <div className="flex items-center gap-3 ml-4">
                                                    <div className="text-center">
                                                        <div className="text-lg font-semibold text-blue-600">{answer.rating}/5</div>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            {[...Array(5)].map((_, i) => (
                                                                <Star
                                                                    key={i}
                                                                    className={`w-4 h-4 ${
                                                                        i < answer.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                                                    }`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <Badge className={`${answerPerformance.bg} ${answerPerformance.color} hover:${answerPerformance.bg}`}>
                                                        {answerPerformance.level}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Answer Section */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                        Your Answer
                                                    </h4>
                                                    <div className="p-4 bg-gray-50 rounded-lg border">
                                                        {answer.isCodingQuestion ? (
                                                            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                                                                {answer.userAns || 'No code submitted'}
                                                            </pre>
                                                        ) : (
                                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                                                {answer.userAns || 'No answer provided'}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                        Expected Answer
                                                    </h4>
                                                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                                        {answer.isCodingQuestion ? (
                                                            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                                                                {answer.correctAns || 'No solution provided'}
                                                            </pre>
                                                        ) : (
                                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                                                {answer.correctAns || 'No expected answer provided'}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Feedback Section */}
                                            {answer.feedback && (
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-medium text-gray-700">Feedback & Suggestions</h4>
                                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                                            {answer.feedback}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Test Cases (for coding questions) */}
                                            {answer.isCodingQuestion && answer.testCases && answer.testCases.length > 0 && (
                                                <div className="space-y-3">
                                                    <h4 className="text-sm font-medium text-gray-700">Test Cases</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {answer.testCases.map((testCase, i) => (
                                                            <div key={i} className="p-3 bg-gray-50 rounded-lg border">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="text-sm font-medium text-gray-700">
                                                                        Test Case {i + 1}
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs text-gray-500">Input:</span>
                                                                        <code className="text-xs bg-gray-200 px-1 rounded">
                                                                            {testCase.input}
                                                                        </code>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs text-gray-500">Expected:</span>
                                                                        <code className="text-xs bg-green-200 px-1 rounded">
                                                                            {testCase.output}
                                                                        </code>
                                                                    </div>
                                                                    {testCase.explanation && (
                                                                        <p className="text-xs text-gray-600">
                                                                            {testCase.explanation}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex gap-4 justify-center">
                    <Link href="/dashboard">
                        <Button variant="outline">
                            Back to Dashboard
                        </Button>
                    </Link>
                    <Link href="/dashboard/interview">
                        <Button>
                            Start New Interview
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
