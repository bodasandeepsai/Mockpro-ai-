"use client";
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function RedirectHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const redirectUrl = searchParams.get('redirect_url');
        if (redirectUrl) {
            // Decode the URL if it's encoded
            const decodedUrl = decodeURIComponent(redirectUrl);
            // Extract just the pathname if it's a full URL
            const pathname = decodedUrl.startsWith('http') 
                ? new URL(decodedUrl).pathname 
                : decodedUrl;
            
            // Redirect after a short delay to ensure authentication is complete
            const timer = setTimeout(() => {
                router.push(pathname);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [searchParams, router]);

    return null;
}