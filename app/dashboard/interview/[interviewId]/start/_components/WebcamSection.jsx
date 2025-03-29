"use client";
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
};

function WebcamSection() {
    const webcamRef = useRef(null);
    const [isWebcamOn, setIsWebcamOn] = useState(false);
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    const [permissionError, setPermissionError] = useState('');

    const checkCameraPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            setPermissionError(error.message);
            setShowPermissionDialog(true);
            return false;
        }
    };

    const toggleWebcam = async () => {
        if (isWebcamOn) {
            if (webcamRef.current) {
                const stream = webcamRef.current.stream;
                stream.getTracks().forEach(track => track.stop());
            }
            setIsWebcamOn(false);
        } else {
            const hasPermission = await checkCameraPermission();
            if (hasPermission) {
                setIsWebcamOn(true);
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Video Interview</h3>
                <Button
                    onClick={toggleWebcam}
                    variant={isWebcamOn ? "destructive" : "default"}
                    className="flex items-center gap-2"
                >
                    {isWebcamOn ? (
                        <>
                            <CameraOff className="h-4 w-4" />
                            Turn Off Camera
                        </>
                    ) : (
                        <>
                            <Camera className="h-4 w-4" />
                            Turn On Camera
                        </>
                    )}
                </Button>
            </div>

            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                {isWebcamOn ? (
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        videoConstraints={videoConstraints}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Camera is turned off</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tips for Video Interview */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Tips for Video Interview</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Ensure good lighting in your environment</li>
                    <li>• Position yourself in the center of the frame</li>
                    <li>• Maintain eye contact with the camera</li>
                    <li>• Speak clearly and at a moderate pace</li>
                    <li>• Dress professionally as you would for a real interview</li>
                </ul>
            </div>

            {/* Permission Dialog */}
            <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            Camera Permission Required
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {permissionError || 'Please allow camera access to enable video interview.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setShowPermissionDialog(false)}>
                            Try Again
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default WebcamSection; 