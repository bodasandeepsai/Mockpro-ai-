"use client"
import React, { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, LoaderCircle, AlertCircle, StopCircle, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { generateInterviewQuestion, generateFeedback } from '@/utils/GemeniAIModal'
import { db } from '@/utils/db'
import { UserAnswer } from '@/utils/schema'
import { useUser } from '@clerk/nextjs'
import moment from 'moment'
import { formatDateForDB } from '@/utils/date'
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from '@/components/ui/textarea';

function RecordAnsSection({ question, mockId, onNext }) {
  const [userAnswer, setUserAnswer] = useState('');
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const accumulatedFinalTextRef = useRef('');

  useEffect(() => {
    console.log('RecordAnsSection mounted with props:', { 
      question, 
      mockId,
      hasUser: !!user,
      userEmail: user?.primaryEmailAddress?.emailAddress 
    });
  }, [question, mockId, user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          accumulatedFinalTextRef.current += finalTranscript;
        }

        setUserAnswer(() => {
          const displayText = accumulatedFinalTextRef.current + (interimTranscript ? ' [...] ' + interimTranscript : '');
          return displayText;
        });
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'network') {
          setPermissionError("Network error detected. Please check your internet connection and try again.");
          setShowManualInput(true);
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setPermissionError("Microphone access was denied. Please allow microphone access and try again.");
          setShowManualInput(true);
        } else if (event.error === 'no-speech') {
          if (isRecording && recognitionRef.current) {
            setTimeout(() => {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.error("Failed to restart after no-speech error:", e);
              }
            }, 1000);
          }
          return;
        } else if (event.error === 'aborted') {
          return;
        } else {
          setPermissionError(`Speech recognition error: ${event.error}. Please try again or type your answer manually.`);
          setShowManualInput(true);
        }
        
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setShowPermissionDialog(true);
        }
      };

      recognitionRef.current.onend = () => {
        if (isRecording && recognitionRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Failed to restart speech recognition:", e);
              setIsRecording(false);
              toast.error("Recording stopped due to an error. Please try again.");
            }
          }, 500);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        setRecordingTime(0);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const StartStopRecording = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      accumulatedFinalTextRef.current = '';
      setUserAnswer('');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (error) {
          console.error("Error starting speech recognition:", error);
          toast.error("Could not start recording. Please check your microphone permissions.");
          setShowPermissionDialog(true);
        }
      }
    }
  };

  const UpdateUserAnswer = async () => {
    try {
      if (!question?.question) {
        console.error('Question is missing');
        toast.error('Question data is missing. Please try again.');
        return;
      }

      if (!mockId) {
        console.error('MockId is missing. Current URL params:', window.location.search);
        toast.error('Interview ID is missing. Please try again.');
        return;
      }

      if (!user?.primaryEmailAddress?.emailAddress) {
        console.error('User email is missing. User state:', user);
        toast.error('User information is missing. Please try again.');
        return;
      }

      const cleanedAnswer = userAnswer
        .replace(/\s*\[\.\.\..\]\s*/g, ' ')
        .trim()
        .slice(0, 5000);
      
      if (!cleanedAnswer) {
        toast.error('No valid answer detected. Please try recording again.');
        return;
      }

      setLoading(true);
      
      try {
        console.log('[RecordAnsSection] Generating AI feedback for answer...');
        
        const feedbackResult = await generateFeedback(
          question.question,
          cleanedAnswer,
          question.answer
        );
        
        let feedback = "Your answer has been recorded.";
        let rating = 3;
        
        if (feedbackResult) {
          feedback = feedbackResult.feedback || feedback;
          rating = parseInt(feedbackResult.rating) || 3;
          console.log('[RecordAnsSection] AI Feedback received:', { feedback, rating });
        } else {
          console.warn('[RecordAnsSection] Feedback generation returned null; using default');
        }

        console.log('[RecordAnsSection] Saving answer to database...');
        try {
          const resp = await db.insert(UserAnswer)
              .values({
              mockIdref: mockId,
              question: question.question,
              userAns: cleanedAnswer,
              correctAns: question.answer,
              feedback: feedback,
              rating: rating,
              userEmail: user.primaryEmailAddress.emailAddress,
              createdAt: formatDateForDB()
            });

          if (resp) {
            console.log('[RecordAnsSection] Answer saved successfully');
            toast.success('Answer recorded successfully');
            setUserAnswer('');
            onNext?.();
          } else {
            throw new Error("No response from database insert");
          }
        } catch (dbError) {
          console.error('[RecordAnsSection] Database error:', dbError);
          toast.error('Failed to save answer. Database error occurred.');
          throw dbError;
        }
      } catch (aiError) {
        console.error('[RecordAnsSection] Error in feedback generation:', aiError);
        toast.error('Error generating feedback. Saving answer with default feedback.');
        
        try {
          const resp = await db.insert(UserAnswer)
              .values({
              mockIdref: mockId,
              question: question.question,
              userAns: cleanedAnswer,
              correctAns: question.answer,
              feedback: "Feedback could not be generated at this time.",
              rating: 0,
              userEmail: user.primaryEmailAddress.emailAddress,
              createdAt: formatDateForDB()
            });
            
          if (resp) {
            toast.success('Answer saved without AI feedback.');
            setUserAnswer('');
            onNext?.();
          }
        } catch (fallbackError) {
          console.error('[RecordAnsSection] Fallback save error:', fallbackError);
          toast.error('Could not save your answer. Please try again later.');
        }
      }
    } catch (error) {
      console.error('[RecordAnsSection] Error in UpdateUserAnswer:', error);
      toast.error('Failed to record answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!question?.question) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          No question available for recording.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-gray-900">Current Question</h3>
              {isRecording && (
                <div className="flex items-center gap-2">
                  <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                  <span className="text-sm font-medium text-gray-600">
                    Recording... {formatTime(recordingTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700">{question.question}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Record Your Answer</h3>
            <div className="flex items-center gap-2">
              {isRecording && (
                <div className="flex items-center gap-2">
                  <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Recording...</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Button
              onClick={StartStopRecording}
              className={`flex items-center gap-2 ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isRecording ? (
                    <>
                      <StopCircle className="h-4 w-4" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      {userAnswer ? 'Re-record' : 'Start Recording'}
                    </>
                  )}
                </>
              )}
            </Button>
            
            {userAnswer && !isRecording && (
              <Button
                variant="outline"
                onClick={() => setShowManualInput(!showManualInput)}
                className="flex items-center gap-2"
              >
                {showManualInput ? 'Back to Recording' : 'Type Instead'}
              </Button>
            )}
          </div>

          {userAnswer && !showManualInput && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">Your Answer</h3>
                {isRecording && (
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                    <span className="text-xs text-gray-500">Listening...</span>
                  </div>
                )}
              </div>
              <div className="bg-white rounded border p-3 min-h-[100px]">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {userAnswer.split(' [...] ').map((part, index, array) => (
                    <React.Fragment key={index}>
                      {index === array.length - 1 && index !== 0 ? (
                        <span className="text-blue-600 italic bg-blue-50 px-1 rounded">
                          {part}
                        </span>
                      ) : (
                        <span>{part}</span>
                      )}
                      {index !== array.length - 1 && ' '}
                    </React.Fragment>
                  ))}
                </p>
                {!userAnswer.trim() && isRecording && (
                  <p className="text-gray-400 italic text-sm">Start speaking...</p>
                )}
              </div>
            </div>
          )}
          
          {showManualInput && (
            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">Type Your Answer</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowManualInput(false);
                    if (!userAnswer) setUserAnswer('');
                  }}
                >
                  Switch Back to Recording
                </Button>
              </div>
              <Textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="min-h-[150px] w-full mb-3"
              />
              <Button 
                onClick={UpdateUserAnswer}
                disabled={loading || !userAnswer.trim()}
                className="w-full"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  "Submit Answer"
                )}
              </Button>
            </div>
          )}

        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Lightbulb className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-900 mb-2">Tips for Recording</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Speak clearly and at a moderate pace
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Find a quiet environment
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Take a moment to think before answering
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                You can re-record if you're not satisfied
              </li>
            </ul>
          </div>
        </div>
      </div>

      <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Microphone Permission Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              {permissionError || 'Please allow microphone access to record your answer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowPermissionDialog(false);
              setShowManualInput(true);
            }}>
              Type Answer Instead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default RecordAnsSection;

