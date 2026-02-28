import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { LogOut, BookOpen, Calendar, LayoutDashboard, Users, BarChart3, Moon, Sun, Settings as SettingsIcon, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

export default function Layout() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark') ||
                localStorage.getItem('theme') === 'dark';
        }
        return false;
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

    const linkClass = (path: string) => `flex items-center px-3 py-2 text-sm font-medium rounded-md transition group ${isActive(path)
        ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
        : "text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent"
        }`;

    const iconClass = (path: string) => `mr-3 h-5 w-5 ${isActive(path) ? "text-indigo-400" : "text-slate-400 group-hover:text-white"
        }`;

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-slate-900 font-sans transition-colors overflow-hidden">

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="h-16 flex items-center justify-between px-6 bg-slate-950">
                    <span className="text-xl font-bold text-white tracking-wide">VERIFINE</span>
                    <button onClick={closeMobileMenu} className="md:hidden text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
                    <nav className="space-y-1 px-3">
                        <Link to="/" onClick={closeMobileMenu} className={linkClass("/")}>
                            <LayoutDashboard className={iconClass("/")} />
                            Dashboard
                        </Link>
                        <Link to="/accounts" onClick={closeMobileMenu} className={linkClass("/accounts")}>
                            <BookOpen className={iconClass("/accounts")} />
                            Chart of Accounts
                        </Link>
                        <Link to="/periods" onClick={closeMobileMenu} className={linkClass("/periods")}>
                            <Calendar className={iconClass("/periods")} />
                            Fiscal Periods
                        </Link>
                        <Link to="/journal-entries" onClick={closeMobileMenu} className={linkClass("/journal-entries")}>
                            <BookOpen className={iconClass("/journal-entries")} />
                            General Ledger
                        </Link>
                        <Link to="/reports" onClick={closeMobileMenu} className={linkClass("/reports")}>
                            <BarChart3 className={iconClass("/reports")} />
                            Reports
                        </Link>

                        <div className="pt-4 mt-2 border-t border-slate-700/50">
                            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Accounts Payable</p>
                            <Link to="/ap/vendors" onClick={closeMobileMenu} className={linkClass("/ap/vendors")}>
                                <Users className={iconClass("/ap/vendors")} />
                                Vendors
                            </Link>
                            <Link to="/ap/bills" onClick={closeMobileMenu} className={linkClass("/ap/bills")}>
                                <BookOpen className={iconClass("/ap/bills")} />
                                Bills
                            </Link>
                        </div>

                        <div className="pt-4 mt-2 border-t border-slate-700/50">
                            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Accounts Receivable</p>
                            <Link to="/ar/customers" onClick={closeMobileMenu} className={linkClass("/ar/customers")}>
                                <Users className={iconClass("/ar/customers")} />
                                Customers
                            </Link>
                            <Link to="/ar/invoices" onClick={closeMobileMenu} className={linkClass("/ar/invoices")}>
                                <BookOpen className={iconClass("/ar/invoices")} />
                                Invoices
                            </Link>
                        </div>

                        <div className="pt-4 mt-2 border-t border-slate-700/50">
                            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System</p>
                            <Link to="/settings" onClick={closeMobileMenu} className={linkClass("/settings")}>
                                <SettingsIcon className={iconClass("/settings")} />
                                Settings
                            </Link>
                        </div>
                    </nav>
                </div>
                <div className="p-4 border-t border-slate-800 shrink-0">
                    <div className="flex items-center mb-4">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
                            {user?.full_name?.charAt(0) || user?.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 truncate">
                            <p className="text-sm font-medium text-white truncate">{user?.full_name || "Accountant"}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center px-3 py-2 text-sm font-medium rounded-md text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition group"
                    >
                        <LogOut className="mr-3 h-5 w-5 text-slate-400 group-hover:text-red-400" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto w-full flex flex-col min-w-0">
                <header className="bg-white dark:bg-slate-950 shadow-sm h-16 flex items-center justify-between px-4 sm:px-8 shrink-0 transition-colors">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden transition-colors"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
                            Workspace
                        </h1>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors shrink-0"
                        aria-label="Toggle theme"
                    >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </header>

                <div className="h-[calc(100vh-4rem)] overflow-y-auto pb-10">
                    <ErrorBoundary>
                        <Outlet />
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
}
