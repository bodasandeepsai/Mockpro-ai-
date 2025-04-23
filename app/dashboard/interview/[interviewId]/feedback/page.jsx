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

    // Unwrap params using React.use()
    const unwrappedParams = use(params);
    // Get interviewId from unwrapped params
    const interviewId = unwrappedParams?.interviewId;

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
                {answers.map((answer, answerIndex) => (
                    <Card key={`answer-${answer.id || answerIndex}`} className="border-l-4 border-blue-500">
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                {/* Question Header */}
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-medium text-gray-900">
                                            Question {answerIndex + 1}
                                            {answer.isCodingQuestion && (
                                                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                                    Coding Question
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-gray-600">{answer.question}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-lg font-semibold text-blue-600">
                                            {(() => {
                                                // Parse the rating value - handle various formats
                                                const ratingStr = answer.rating || "0/5";
                                                
                                                // Check if rating already contains a fraction (e.g., "3/5")
                                                if (ratingStr.includes('/')) {
                                                    // Return the rating as is, without adding extra suffix
                                                    return ratingStr;
                                                } else {
                                                    // If it's just a number, add the /5 suffix
                                                    const numericRating = parseInt(ratingStr) || 0;
                                                    return `${numericRating}/5`;
                                                }
                                            })()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {[...Array(5)].map((_, i) => {
                                                // Extract numeric part of rating for star display
                                                const ratingStr = answer.rating || "0";
                                                let numericRating = 0;
                                                
                                                if (ratingStr.includes('/')) {
                                                    // Extract the first number from patterns like "3/5"
                                                    const match = ratingStr.match(/^(\d+)/);
                                                    numericRating = match ? parseInt(match[1]) : 0;
                                                } else {
                                                    numericRating = parseInt(ratingStr) || 0;
                                                }
                                                
                                                return (
                                                    <Star
                                                        key={i}
                                                        className={`w-4 h-4 ${
                                                            i < numericRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                                        }`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Answer Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700">
                                            {answer.isCodingQuestion ? "Your Code" : "Your Answer"}
                                        </h4>
                                        <div className="p-3 bg-gray-50 rounded-lg overflow-x-auto">
                                            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                                                <code>
                                                    {answer.userAns}
                                                </code>
                                            </pre>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700">
                                            {answer.isCodingQuestion ? "Model Solution" : "Correct Answer"}
                                        </h4>
                                        <div className="p-3 bg-green-50 rounded-lg overflow-x-auto">
                                            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                                                <code>
                                                    {answer.correctAns}
                                                </code>
                                            </pre>
                                        </div>
                                    </div>
                                </div>

                                {/* Feedback Section */}
                                <div className="space-y-2">
                                     <h4 className="text-sm font-medium text-gray-700">Feedback</h4>
                                     <div className="p-3 bg-blue-50 rounded-lg">
                                         {answer.feedback && answer.feedback.includes('##') ? (
                                             // Render markdown for structured feedback
                                             <div className="prose prose-sm max-w-none text-gray-800">
                                                 {(() => {
                                                     const lines = answer.feedback.split('\n');
                                                     const renderedContent = [];
                                                     let inCodeBlock = false;
                                                     let codeContent = '';
                                                     let codeBlockIndex = 0;
                                                     
                                                     // Process line by line
                                                     for (let i = 0; i < lines.length; i++) {
                                                         const line = lines[i];
                                                         
                                                         // Handle code blocks
                                                         if (line.trim().startsWith('```')) {
                                                             if (inCodeBlock) {
                                                                 // End of code block
                                                                 renderedContent.push(
                                                                     <div key={`code-${codeBlockIndex}`} className="bg-gray-800 text-white p-3 rounded-md overflow-x-auto my-2">
                                                                         <pre className="text-xs">
                                                                             <code>{codeContent}</code>
                                                                         </pre>
                                                                     </div>
                                                                 );
                                                                 codeContent = '';
                                                                 codeBlockIndex++;
                                                                 inCodeBlock = false;
                                                             } else {
                                                                 // Start of code block
                                                                 inCodeBlock = true;
                                                             }
                                                             continue;
                                                         }
                                                         
                                                         // Inside code block
                                                         if (inCodeBlock) {
                                                             codeContent += line + '\n';
                                                             continue;
                                                         }
                                                         
                                                         // Normal markdown content
                                                         // Handle headings
                                                         if (line.startsWith('## ')) {
                                                             renderedContent.push(
                                                                 <h3 key={`heading-${i}`} className="text-lg font-semibold mt-4 mb-2">
                                                                     {line.replace('## ', '')}
                                                                 </h3>
                                                             );
                                                         } else if (line.startsWith('### ')) {
                                                             renderedContent.push(
                                                                 <h4 key={`subheading-${i}`} className="text-md font-semibold mt-3 mb-1">
                                                                     {line.replace('### ', '')}
                                                                 </h4>
                                                             );
                                                         }
                                                         // Handle bullet points
                                                         else if (line.startsWith('- ')) {
                                                             renderedContent.push(
                                                                 <li key={`bullet-${i}`} className="ml-4 text-sm">
                                                                     {line.substring(2)}
                                                                 </li>
                                                             );
                                                         }
                                                         // Handle empty lines as paragraph breaks
                                                         else if (line.trim() === '') {
                                                             renderedContent.push(<br key={`br-${i}`} />);
                                                         }
                                                         // Regular paragraph
                                                         else {
                                                             renderedContent.push(
                                                                 <p key={`p-${i}`} className="text-sm mb-2">
                                                                     {line}
                                                                 </p>
                                                             );
                                                         }
                                                     }
                                                     
                                                     // Handle unclosed code block
                                                     if (inCodeBlock && codeContent) {
                                                         renderedContent.push(
                                                             <div key={`code-${codeBlockIndex}`} className="bg-gray-800 text-white p-3 rounded-md overflow-x-auto my-2">
                                                                 <pre className="text-xs">
                                                                     <code>{codeContent}</code>
                                                                 </pre>
                                                             </div>
                                                         );
                                                     }
                                                     
                                                     return renderedContent;
                                                 })()}
                                             </div>
                                         ) : (
                                             <p className="text-sm text-gray-800 whitespace-pre-wrap">{answer.feedback}</p>
                                         )}
                                     </div>
                                 </div>

                                {/* Test Cases (for coding questions) */}
                                {answer.isCodingQuestion && answer.testCases && (
                                    <div className="space-y-4 mt-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-gray-700">Test Cases</h4>
                                            
                                            {(() => {
                                                try {
                                                    const testCases = JSON.parse(answer.testCases);
                                                    if (!Array.isArray(testCases)) return null;
                                                    
                                                    // Parse user code execution results if available
                                                    let userResults = [];
                                                    try {
                                                        if (answer.userCodeResults) {
                                                            userResults = JSON.parse(answer.userCodeResults);
                                                        }
                                                    } catch (e) {
                                                        console.error("Error parsing user results:", e);
                                                        userResults = [];
                                                    }
                                                    
                                                    // Fallback - create simple pass/fail results if real results are missing
                                                    if (!userResults || userResults.length === 0) {
                                                        userResults = testCases.map(testCase => ({
                                                            input: testCase.input,
                                                            expected: testCase.output,
                                                            output: "No output (code not executed)",
                                                            passed: false
                                                        }));
                                                    }
                                                    
                                                    // Count passed tests
                                                    const passedTests = userResults.filter(r => r.passed).length;
                                                    const totalTests = testCases.length;
                                                    const passRatio = totalTests > 0 ? (passedTests / totalTests) : 0;
                                                    
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-medium ${passRatio >= 0.7 ? 'text-green-600' : passRatio >= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                {passedTests}/{totalTests} tests passed
                                                            </span>
                                                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full ${passRatio >= 0.7 ? 'bg-green-500' : passRatio >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                    style={{ width: `${passRatio * 100}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    );
                                                } catch (e) {
                                                    return null;
                                                }
                                            })()}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-4">
                                            {(() => {
                                                try {
                                                    const testCases = JSON.parse(answer.testCases);
                                                    if (!Array.isArray(testCases)) {
                                                        return <p className="text-sm text-red-500">Invalid test case data</p>;
                                                    }
                                                    
                                                    // Parse user code execution results if available
                                                    let userResults = [];
                                                    try {
                                                        if (answer.userCodeResults) {
                                                            userResults = JSON.parse(answer.userCodeResults);
                                                        }
                                                    } catch (e) {
                                                        console.error("Error parsing user results:", e);
                                                        userResults = [];
                                                    }
                                                    
                                                    // Fallback - create simple pass/fail results if real results are missing
                                                    if (!userResults || userResults.length === 0) {
                                                        userResults = testCases.map(testCase => ({
                                                            input: testCase.input,
                                                            expected: testCase.output,
                                                            output: "No output (code not executed)",
                                                            passed: false
                                                        }));
                                                    }
                                                    
                                                    return testCases.map((testCase, testCaseIndex) => {
                                                        // Find matching user result for this test case
                                                        const userResult = userResults[testCaseIndex] || {
                                                            passed: false,
                                                            output: "No output available"
                                                        };
                                                        
                                                        return (
                                                            <div key={`test-case-${testCaseIndex}`} className={`p-4 rounded-lg border-l-4 ${userResult.passed ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="text-sm font-medium text-gray-700">
                                                                        Test Case {testCaseIndex + 1}
                                                                    </span>
                                                                    {userResult.passed ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                                            <span className="text-xs text-green-500">Passed</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1">
                                                                            <XCircle className="w-4 h-4 text-red-500" />
                                                                            <span className="text-xs text-red-500">Failed</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                                    <div className="space-y-1">
                                                                        <p className="text-xs font-medium text-gray-700">Input:</p>
                                                                        <pre className="text-xs p-2 bg-gray-100 rounded whitespace-pre-wrap overflow-x-auto">
                                                                            {testCase.input}
                                                                        </pre>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between">
                                                                            <p className="text-xs font-medium text-gray-700">Expected Output:</p>
                                                                            <p className="text-xs font-medium text-gray-700">Your Output:</p>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <pre className="text-xs p-2 bg-gray-100 rounded whitespace-pre-wrap overflow-x-auto">
                                                                                {testCase.output}
                                                                            </pre>
                                                                            <pre className={`text-xs p-2 rounded whitespace-pre-wrap overflow-x-auto ${userResult.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                                                                                {userResult.output || "No output"}
                                                                            </pre>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {testCase.explanation && (
                                                                    <div className="mt-2">
                                                                        <p className="text-xs font-medium text-gray-700">Explanation:</p>
                                                                        <p className="text-xs text-gray-600 mt-1">{testCase.explanation}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                } catch (e) {
                                                    return <p className="text-sm text-red-500">Error processing test cases: {e.message}</p>;
                                                }
                                            })()}
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
