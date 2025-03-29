"use client";
import { useEffect, useState, use } from "react";
import { db } from "@/utils/db";
import { UserAnswer, MockInterview } from "@/utils/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import * as monaco from '@monaco-editor/react'

export default function Feedback({ params }) {
    const { user } = useUser();
    const [answers, setAnswers] = useState([]);
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const mockId = searchParams.get('mockId');

    // Get interviewId from params
    const interviewId = params?.interviewId;

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!mockId) {
                    toast.error('Interview ID not found');
                    return;
                }

                // Fetch interview details
                const interviewData = await db.select()
                    .from(MockInterview)
                    .where(eq(MockInterview.mockId, mockId));

                if (interviewData.length === 0) {
                    toast.error('Interview not found');
                    return;
                }
                setInterview(interviewData[0]);

                // Fetch user answers
                const userAnswers = await db.select()
                    .from(UserAnswer)
                    .where(eq(UserAnswer.mockIdref, mockId))
                    .orderBy(UserAnswer.id);
                setAnswers(userAnswers);
            } catch (error) {
                console.error('Error fetching data:', error);
                toast.error('Failed to load interview data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [mockId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">{error}</div>
            </div>
        );
    }

    if (!interview) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Interview not found.</p>
            </div>
        );
    }

    const calculateOverallRating = () => {
        if (!answers.length) return 0;
        const total = answers.reduce((acc, answer) => {
            const rating = parseInt(answer.rating) || 0;
            return acc + rating;
        }, 0);
        return Math.round(total / answers.length);
    };

    const overallRating = calculateOverallRating();

    return (
        <div className="container mx-auto py-8 px-4">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Interview Feedback</h1>
                        <p className="text-gray-600 mt-1">Review your performance and learn from the feedback</p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Button>
                </div>
            </div>

            {/* Overall Performance Card */}
            <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-gray-900">Overall Performance</h3>
                            <p className="text-sm text-gray-600">Based on {answers.length} questions</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-3xl font-bold text-blue-600">{overallRating}/5</div>
                            <div className="flex items-center gap-1">
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
                </CardContent>
            </Card>

            {/* Questions Feedback */}
            <div className="space-y-6">
                {answers.map((answer, index) => (
                    <Card key={index} className="border-l-4 border-blue-500">
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                {/* Question Header */}
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-medium text-gray-900">
                                            Question {index + 1}
                                            {answer.isCodingQuestion && (
                                                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                                    Coding Question
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-gray-600">{answer.question}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-lg font-semibold text-blue-600">{answer.rating}/5</div>
                                        <div className="flex items-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-4 h-4 ${
                                                        i < parseInt(answer.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Answer Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700">Your Answer</h4>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                                                {answer.userAns}
                                            </pre>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700">Correct Answer</h4>
                                        <div className="p-3 bg-green-50 rounded-lg">
                                            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                                                {answer.correctAns}
                                            </pre>
                                        </div>
                                    </div>
                                </div>

                                {/* Feedback Section */}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-gray-700">Feedback</h4>
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-gray-800">{answer.feedback}</p>
                                    </div>
                                </div>

                                {/* Test Cases (for coding questions) */}
                                {answer.isCodingQuestion && answer.testCases && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700">Test Cases</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {JSON.parse(answer.testCases).map((testCase, i) => (
                                                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-sm font-medium text-gray-700">
                                                            Test Case {i + 1}
                                                        </span>
                                                        {testCase.output === answer.userAns ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 text-red-500" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-gray-600">Input: {testCase.input}</p>
                                                        <p className="text-xs text-gray-600">Expected: {testCase.output}</p>
                                                        <p className="text-xs text-gray-600">Explanation: {testCase.explanation}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
