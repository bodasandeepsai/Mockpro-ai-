"use client"
import React, { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, LoaderCircle, AlertCircle, StopCircle, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { generateInterviewQuestion } from '@/utils/GemeniAIModal'
import { db } from '@/utils/db'
import { UserAnswer } from '@/utils/schema'
import { useUser } from '@clerk/nextjs'
import moment from 'moment'
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
  const [showManualInput, setShowManualInput] = useState(false); // State for showing manual input option

  // Add logging for props
  useEffect(() => {
    console.log('RecordAnsSection mounted with props:', { 
      question, 
      mockId,
      hasUser: !!user,
      userEmail: user?.primaryEmailAddress?.emailAddress 
    });
  }, [question, mockId, user]);

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true; // This is crucial for real-time display
      recognitionRef.current.lang = 'en-US';

      // Enhanced onresult handler to better handle interim results
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Process results, separating final from interim
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        // Update the answer with both final and current interim results
        setUserAnswer((prev) => {
          // Combine any previous finalized text with new final and interim text
          const finalText = prev.replace(/\s*\[\.\.\..\]$/, ''); // Remove any previous interim marker
          return finalText + finalTranscript + (interimTranscript ? ' [...] ' + interimTranscript : '');
        });
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // Handle specific error types
        if (event.error === 'network') {
          setPermissionError("Network error detected. Please check your internet connection and try again. You can also type your answer manually.");
          setShowManualInput(true); // Show manual input option when network error occurs
          
          // Auto-retry network errors after a short delay
          setTimeout(() => {
            if (isRecording && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                console.log("Auto-retrying speech recognition after network error");
              } catch (e) {
                console.error("Failed to restart speech recognition:", e);
              }
            }
          }, 3000);
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setPermissionError("Microphone access was denied. Please allow microphone access and try again, or type your answer manually.");
          setShowManualInput(true); // Show manual input option for permission issues
        } else if (event.error === 'no-speech') {
          // No speech detected, just restart without showing error dialog
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Failed to restart after no-speech error:", e);
            }
          }
          return; // Don't show dialog for no-speech errors
        } else {
          setPermissionError(`Speech recognition error: ${event.error}. Please try again or type your answer manually.`);
          setShowManualInput(true); // Show manual input for any other errors
        }
        
        setShowPermissionDialog(true);
      };

      recognitionRef.current.onend = () => {
        if (isRecording) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Failed to restart speech recognition:", e);
          }
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      setPermissionError(error.message);
      setShowPermissionDialog(true);
      return false;
    }
  };

  const StartStopRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      const hasPermission = await checkMicrophonePermission();
      if (hasPermission) {
        startRecording();
      }
    }
  };

  const startRecording = async () => {
    try {
      if (!recognitionRef.current) {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
          // Reinitialize if somehow lost
          recognitionRef.current = new window.webkitSpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.lang = 'en-US';
          
          // Enhanced onresult handler
          recognitionRef.current.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            // Process results, separating final from interim
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }

            // Update the answer with both final and current interim results
            setUserAnswer((prev) => {
              // Combine any previous finalized text with new final and interim text
              const finalText = prev.replace(/\s*\[\.\.\..\]$/, ''); // Remove any previous interim marker
              return finalText + finalTranscript + (interimTranscript ? ' [...] ' + interimTranscript : '');
            });
          };
          
          recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
              setPermissionError(event.error);
              setShowPermissionDialog(true);
            }
          };
          
          recognitionRef.current.onend = () => {
            if (isRecording) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.error("Failed to restart speech recognition:", e);
              }
            }
          };
        } else {
          // Browser doesn't support speech recognition
          toast.error("Speech recognition is not supported in your browser. Please try a different browser like Chrome.");
          return;
        }
      }
      
      // Add a try-catch around the start call
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        toast.success("Recording started");
      } catch (startError) {
        console.error("Error starting recording:", startError);
        toast.error("Failed to start recording. Please refresh the page and try again.");
        setShowPermissionDialog(true);
      }
    } catch (err) {
      console.error("Error in startRecording:", err);
      toast.error("Could not initialize speech recognition. Please try refreshing the page.");
      setShowPermissionDialog(true);
    }
  };

  const stopRecording = async () => {
    try {
      if (recognitionRef.current && isRecording) {
        try {
          recognitionRef.current.stop();
        } catch (stopError) {
          console.error("Error stopping speech recognition:", stopError);
          // Continue with the function even if stop fails
        }
        
        setIsRecording(false);
        toast.success("Recording stopped");
        
        // Save the answer immediately after stopping
        if (userAnswer.length > 10) {
          console.log('Attempting to save answer:', {
            question,
            mockId,
            userAnswerLength: userAnswer.length,
            userEmail: user?.primaryEmailAddress?.emailAddress
          });
          await UpdateUserAnswer();
        } else {
          console.log('Answer too short to save:', userAnswer.length);
          toast.info('Answer is too short to save. Please record a longer answer.');
        }
      }
    } catch (error) {
      console.error("Error in stopRecording:", error);
      toast.error("There was an error stopping the recording. Your answer might not be saved.");
    }
  };

  const UpdateUserAnswer = async () => {
    // Add detailed logging
    console.log('UpdateUserAnswer called with:', {
      question,
      mockId,
      userAnswerLength: userAnswer.length,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      isAuthenticated: !!user
    });

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

      // Clean the user answer - remove interim markers and indicators
      const cleanedAnswer = userAnswer
        .replace(/\s*\[\.\.\..\]\s*/g, ' ')  // Remove [...] markers
        .trim()
        .slice(0, 5000); // Limit to 5000 chars max
      
      if (!cleanedAnswer) {
        toast.error('No valid answer detected. Please try recording again.');
        return;
      }

      setLoading(true);
      
      try {
        console.log('Generating feedback via AI...');
        
        // Create a custom job description for feedback generation with a clean, limited answer
        const feedbackJobDesc = `Provide feedback on this interview answer: "${cleanedAnswer}" for the question: "${question.question}"`;
        
        // Use the modified generateInterviewQuestion function
        const aiResponse = await generateInterviewQuestion("Interview Feedback Specialist", feedbackJobDesc, "5");
        
        // Extract feedback and rating from the AI response
        let feedback = "";
        let rating = "";
        
        if (aiResponse.error) {
          // Handle case when AI response has an error
          console.warn('AI returned an error response:', aiResponse.error);
          feedback = "We couldn't generate specific feedback at this time. Please review your answer against the model answer provided.";
          rating = "N/A";
        } else {
          // Extract feedback from different possible response formats
          feedback = aiResponse.idealAnswer || 
                    aiResponse.context || 
                    aiResponse.solution || 
                    "Your answer has been recorded. Compare it with the model answer for self-assessment.";
          
          // Try to determine a rating from the AI response or keyPoints
          const keyPoints = aiResponse.keyPoints || [];
          const keyPointsText = keyPoints.join(" ");
          
          // Look for rating patterns in response
          const ratingMatch = (aiResponse.question || feedback || keyPointsText).match(/(\d+)\/(\d+)|(\d+)\s*stars|rating[:\s]+(\d+)/i);
          rating = ratingMatch ? ratingMatch[0] : "3/5";
        }
        
        console.log('Generated feedback:', { feedback, rating });

        console.log('Attempting to save answer to database...');
        try {
          const resp = await db.insert(UserAnswer)
            .values({
              mockIdref: mockId,
              question: question.question,
              userAns: cleanedAnswer,
              correctAns: question.answer,
              feedback: feedback || "Feedback unavailable",
              rating: rating || "3/5",
              userEmail: user.primaryEmailAddress.emailAddress,
              createdAt: moment().format('DD-MM-YYYY')
            });

          if (resp) {
            console.log('Answer saved successfully');
            toast.success('Answer recorded successfully');
            setUserAnswer('');
            onNext?.(); // Call onNext if provided
          } else {
            throw new Error("No response from database insert");
          }
        } catch (dbError) {
          console.error('Database error:', dbError);
          toast.error('Failed to save answer. Database error occurred.');
          throw dbError;
        }
      } catch (aiError) {
        console.error('AI error:', aiError);
        toast.error('Error generating feedback. Saving answer without feedback.');
        
        // Try to save answer even without AI feedback as a fallback
        try {
          const resp = await db.insert(UserAnswer)
            .values({
              mockIdref: mockId,
              question: question.question,
              userAns: cleanedAnswer,
              correctAns: question.answer,
              feedback: "Feedback could not be generated at this time.",
              rating: "N/A",
              userEmail: user.primaryEmailAddress.emailAddress,
              createdAt: moment().format('DD-MM-YYYY')
            });
            
          if (resp) {
            toast.success('Answer saved without AI feedback.');
            setUserAnswer('');
            onNext?.(); // Call onNext if provided
          }
        } catch (fallbackError) {
          console.error('Fallback save error:', fallbackError);
          toast.error('Could not save your answer. Please try again later.');
        }
      }
    } catch (error) {
      console.error('Error in UpdateUserAnswer:', error);
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
      {/* Question Display */}
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

      {/* Recording Controls */}
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

          <div className="flex justify-center">
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
                      Start Recording
                    </>
                  )}
                </>
              )}
            </Button>
          </div>

          {/* Transcription Preview or Manual Input */}
          {userAnswer && !showManualInput && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Your Answer</h3>
              <p className="text-sm text-gray-600">
                {/* Display final text normally, but style interim results differently */}
                {userAnswer.split(' [...] ').map((part, index, array) => (
                  <React.Fragment key={index}>
                    {index === array.length - 1 && index !== 0 ? (
                      <span className="text-gray-500 italic">{part}</span>
                    ) : (
                      part
                    )}
                    {index !== array.length - 1 && ' '}
                  </React.Fragment>
                ))}
              </p>
            </div>
          )}
          
          {/* Manual Text Input Option */}
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

      {/* Tips Section */}
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

      {/* Permission Dialog */}
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
              // Offer manual input if user closes the dialog
              setShowManualInput(true);
            }}>
              Try Again
            </AlertDialogAction>
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
