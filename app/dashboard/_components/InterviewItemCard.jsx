import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import React from 'react'
import { Clock, MessageSquare, Play } from 'lucide-react'
import moment from 'moment'

function InterviewItemCard({interview}) {
    const router = useRouter();

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
        return moment(date).fromNow();
    };

    const onStart=()=>{
        router.push('/dashboard/interview/'+interview?.mockId)
    }

    const onFeedback=()=>{
        router.push('/dashboard/interview/'+interview?.mockId+'/feedback?mockId='+interview?.mockId)
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">{interview?.jobPosition}</h2>
                        <div className="flex items-center text-sm text-gray-500 mb-2">
                            <Clock className="h-4 w-4 mr-1" />
                            {interview.jobExperience} years of experience
                        </div>
                        <p className="text-xs text-gray-400">
                            Created {formatDateForDisplay(interview.createdAt)}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex items-center gap-2"
                            onClick={onFeedback}
                        >
                            <MessageSquare className="h-4 w-4" />
                            Feedback
                        </Button>
                        <Button 
                            size="sm" 
                            className="flex items-center gap-2"
                            onClick={onStart}
                        >
                            <Play className="h-4 w-4" />
                            Start
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InterviewItemCard
