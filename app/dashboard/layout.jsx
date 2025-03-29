"use client";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function DashboardLayout({ children }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

    const navigation = [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'New Interview', href: '/dashboard/interview' },
        { name: 'History', href: '/dashboard/history' },
        { name: 'How It Works', href: '#', isDialog: true },
        { name: 'Upgrade', href: '#', isDialog: true },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between items-center">
                        <div className="flex items-center">
                            <Link href="/dashboard" className="flex items-center">
                                <span className="text-xl font-bold text-blue-600">MockPro-AI</span>
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center space-x-8">
                            {navigation.map((item) => (
                                item.isDialog ? (
                                    item.name === 'How It Works' ? (
                                        <Dialog key={item.name}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                                                    {item.name}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[600px]">
                                                <DialogHeader>
                                                    <DialogTitle className="text-2xl font-bold text-gray-900">How MockPro-AI Works</DialogTitle>
                                                    <DialogDescription className="text-gray-600">
                                                        Your AI-powered interview preparation platform
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="mt-6 space-y-6">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-2 bg-blue-100 rounded-full">
                                                            <span className="text-blue-600 font-bold">1</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900">Create Your Interview</h3>
                                                            <p className="text-gray-600 mt-1">Select your job position, experience level, and get personalized interview questions.</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-2 bg-blue-100 rounded-full">
                                                            <span className="text-blue-600 font-bold">2</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900">Practice Questions</h3>
                                                            <p className="text-gray-600 mt-1">Answer questions verbally or write code solutions in our interactive environment.</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-2 bg-blue-100 rounded-full">
                                                            <span className="text-blue-600 font-bold">3</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900">Get Instant Feedback</h3>
                                                            <p className="text-gray-600 mt-1">Receive detailed feedback, ratings, and suggestions for improvement.</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-2 bg-blue-100 rounded-full">
                                                            <span className="text-blue-600 font-bold">4</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900">Track Progress</h3>
                                                            <p className="text-gray-600 mt-1">Monitor your performance over time and identify areas for improvement.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <Dialog key={item.name}>
                                            <DialogTrigger asChild>
                                                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700">
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                    {item.name}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[600px]">
                                                <DialogHeader>
                                                    <DialogTitle className="text-2xl font-bold text-gray-900">Upgrade to Pro</DialogTitle>
                                                    <DialogDescription className="text-gray-600">
                                                        Unlock advanced features and accelerate your interview preparation
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="mt-6 space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="p-6 bg-white rounded-lg border border-gray-200">
                                                            <h3 className="text-xl font-bold text-gray-900 mb-4">Free Plan</h3>
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                                    <span className="text-gray-600">Basic interview questions</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                                    <span className="text-gray-600">Voice recording</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                                    <span className="text-gray-600">Basic feedback</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-500">
                                                            <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg text-sm font-medium">
                                                                Popular
                                                            </div>
                                                            <h3 className="text-xl font-bold text-gray-900 mb-4">Pro Plan</h3>
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                                                    <span className="text-gray-600">Advanced coding questions</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                                                    <span className="text-gray-600">AI-powered feedback</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                                                    <span className="text-gray-600">Performance analytics</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                                                    <span className="text-gray-600">Priority support</span>
                                                                </div>
                                                            </div>
                                                            <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700">
                                                                Upgrade Now
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )
                                ) : (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`text-sm font-medium ${
                                            pathname === item.href
                                                ? 'text-blue-600'
                                                : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                    >
                                        {item.name}
                                    </Link>
                                )
                            ))}
                            <UserButton afterSignOutUrl="/" />
                        </nav>

                        {/* Mobile menu button */}
                        <div className="flex md:hidden">
                            <Button
                                variant="ghost"
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                            >
                                {isMenuOpen ? (
                                    <X className="h-6 w-6" />
                                ) : (
                                    <Menu className="h-6 w-6" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMenuOpen && (
                    <div className="md:hidden">
                        <div className="space-y-1 px-2 pb-3 pt-2">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                                        pathname === item.href
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {item.name}
                                </Link>
                            ))}
                            <div className="px-3 py-2">
                                <UserButton afterSignOutUrl="/" />
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="py-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
