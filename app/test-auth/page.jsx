"use client";
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TestAuth() {
    const { user, isLoaded } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded) {
            if (user) {
                console.log('User is signed in:', user);
                router.push('/dashboard');
            } else {
                console.log('User is not signed in');
                router.push('/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3000%2Fdashboard');
            }
        }
    }, [user, isLoaded, router]);

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h1>Auth Test</h1>
            <p>User: {user ? 'Signed in' : 'Not signed in'}</p>
        </div>
    );
}