import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Users, Receipt, Landmark, ShieldCheck, Zap } from 'lucide-react';

const features = [
    {
        title: "Financial Reporting",
        description: "Generate professional P&L, Balance Sheets, and Cash Flow statements in seconds.",
        icon: BarChart3,
        color: "bg-blue-500"
    },
    {
        title: "Automated Payroll",
        description: "Process salaries, taxes, and benefits with one-click automation.",
        icon: Users,
        color: "bg-indigo-500"
    },
    {
        title: "Invoice Management",
        description: "Track receivables and payables effortlessly with automated reminders.",
        icon: Receipt,
        color: "bg-purple-500"
    },
    {
        title: "Bank Reconciliation",
        description: "Sync and reconcile bank transactions for accurate books.",
        icon: Landmark,
        color: "bg-emerald-500"
    },
    {
        title: "Secure & Compliant",
        description: "Enterprise-grade security and audit logs for full transparency.",
        icon: ShieldCheck,
        color: "bg-sky-500"
    },
    {
        title: "Real-time Insights",
        description: "Monitor your business health with a dynamic, live dashboard.",
        icon: Zap,
        color: "bg-amber-500"
    }
];

export const Carousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % features.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative h-full w-full overflow-hidden flex flex-col items-center justify-center p-8 bg-indigo-900/10 rounded-3xl border border-white/10 backdrop-blur-sm pb-20">
            <AnimatePresence mode='wait'>
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="flex flex-col items-center text-center"
                >
                    {(() => {
                        const Icon = features[currentIndex].icon;
                        return (
                            <div className={`p-4 rounded-2xl ${features[currentIndex].color} shadow-lg mb-8`}>
                                <Icon className="w-12 h-12 text-white" />
                            </div>
                        );
                    })()}
                    <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">
                        {features[currentIndex].title}
                    </h3>
                    <p className="text-indigo-100/80 text-lg max-w-sm leading-relaxed">
                        {features[currentIndex].description}
                    </p>
                </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-10 flex space-x-3">
                {features.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex
                            ? "w-8 bg-indigo-400"
                            : "w-2 bg-white/20 hover:bg-white/40"
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};
