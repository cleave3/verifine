import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { Carousel } from "../components/Carousel";
import { Mail, Lock, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
    const [email, setEmail] = useState("admin@verifine.com");
    const [password, setPassword] = useState("verifineadmin2026");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const login = useAuthStore(state => state.login);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await login({ email, password });
            navigate("/");
        } catch (err: any) {
            setError(err.response?.data?.message || "Invalid credentials. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white dark:bg-slate-950 font-sans selection:bg-indigo-500/30">
            {/* Left Side: Login Form */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 lg:px-20 py-12">
                <div className="max-w-md w-full">
                    {/* Logo & Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-12"
                    >
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                                <ShieldCheck className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
                                VERIFINE
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                            Welcome back
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            The intelligent workspace for modern accountants.
                        </p>
                    </motion.div>

                    {/* Login Form */}
                    <motion.form
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="space-y-6"
                        onSubmit={handleSubmit}
                    >
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-3 animate-pulse" />
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Email
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Password
                                    </label>
                                    <button type="button" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition">
                                        Forgot Password?
                                    </button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* <div className="flex items-center">
                            <input
                                id="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                Keep me logged in for 30 days
                            </label>
                        </div> */}

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full flex justify-center items-center py-4 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Authorize Access
                                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.form>

                    {/* Trust Indicators */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.8 }}
                        className="mt-12 flex flex-col items-center"
                    >
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                <span>SOC2 compliant</span>
                            </div>
                            <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                                <span>256-bit encryption</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Right Side: Feature Carousel (Hidden on Mobile) */}
            <div className="hidden lg:flex flex-1 relative bg-slate-900 overflow-hidden m-4 rounded-4xl">
                <div className="absolute inset-0 bg-linear-to-br from-indigo-600/20 via-slate-900 to-slate-950 z-0" />

                {/* Decorative Elements */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 w-full flex items-center justify-center">
                    <div className="w-full max-w-xl">
                        <Carousel />
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="absolute bottom-8 left-12 right-12 flex justify-between items-center z-10">
                    <p className="text-slate-500 text-sm font-medium">
                        &copy; 2026 Verifine Technologies. All rights reserved.
                    </p>
                    {/* <div className="flex space-x-6 text-slate-500 text-sm font-bold">
                        <a href="#" className="hover:text-white transition">Privacy</a>
                        <a href="#" className="hover:text-white transition">Terms</a>
                        <a href="#" className="hover:text-white transition">Support</a>
                    </div> */}
                </div>
            </div>
        </div>
    );
}
