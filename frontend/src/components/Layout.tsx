import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { LogOut, BookOpen, Calendar, LayoutDashboard, Users, BarChart3, Moon, Sun, Settings as SettingsIcon, Menu, X, FileText, Receipt, User as UserIcon, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { RoleGuard } from "./RoleGuard";

export default function Layout() {
    const { user, currentOrg, logout } = useAuthStore();
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
                                <Receipt className={iconClass("/ap/bills")} />
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
                                <FileText className={iconClass("/ar/invoices")} />
                                Invoices
                            </Link>
                        </div>

                        <div className="pt-4 mt-2 border-t border-slate-700/50">
                            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System</p>
                            <RoleGuard allowedRoles={['admin', 'controller']}>
                                <Link to="/audit" onClick={closeMobileMenu} className={linkClass("/audit")}>
                                    <Activity className={iconClass("/audit")} />
                                    Audit Log
                                </Link>
                            </RoleGuard>
                            <RoleGuard allowedRoles={['admin']}>
                                <Link to="/users" onClick={closeMobileMenu} className={linkClass("/users")}>
                                    <Users className={iconClass("/users")} />
                                    Team Management
                                </Link>
                            </RoleGuard>
                            <Link to="/settings" onClick={closeMobileMenu} className={linkClass("/settings")}>
                                <SettingsIcon className={iconClass("/settings")} />
                                Settings
                            </Link>
                        </div>
                    </nav>
                </div>
                <div className="p-4 border-t border-slate-800 shrink-0">
                    <Link to="/profile" onClick={closeMobileMenu} className="flex items-center mb-4 p-2 -mx-2 rounded-md hover:bg-slate-800 transition-colors cursor-pointer group">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold group-hover:bg-indigo-500 transition-colors relative">
                            {user?.full_name?.charAt(0) || user?.email.charAt(0).toUpperCase()}
                            <div className="absolute -bottom-1 -right-1 bg-slate-800 rounded-full p-0.5">
                                <UserIcon className="w-3 h-3 text-indigo-400 group-hover:text-white" />
                            </div>
                        </div>
                        <div className="ml-3 truncate">
                            <p className="text-sm font-medium text-white truncate">{user?.full_name || "User"}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        </div>
                    </Link>
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
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <header className="bg-white dark:bg-slate-950 shadow-sm h-16 flex items-center justify-between px-4 sm:px-8 shrink-0 transition-colors z-20">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate tracking-tight">
                            Workspace
                        </h1>
                        <span className="text-xs text-slate-500 dark:text-slate-400 -mt-1 truncate max-w-[200px]">{currentOrg?.name || 'Verifine'}</span>
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors shrink-0"
                        aria-label="Toggle theme"
                    >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto pb-20 md:pb-10 relative">
                    <ErrorBoundary>
                        <Outlet />
                    </ErrorBoundary>
                </main>
            </div>

            {/* Bottom Mobile Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 z-30 flex justify-around items-center h-16 px-1 safe-area-pb">
                <Link to="/" className={`flex flex-col items-center justify-center w-full h-full ${isActive('/') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    <LayoutDashboard className="w-[22px] h-[22px] mb-1" />
                    <span className="text-[10px] font-medium leading-none">Home</span>
                </Link>
                <Link to="/ar/invoices" className={`flex flex-col items-center justify-center w-full h-full ${isActive('/ar/invoices') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    <FileText className="w-[22px] h-[22px] mb-1" />
                    <span className="text-[10px] font-medium leading-none">Invoices</span>
                </Link>
                <Link to="/ap/bills" className={`flex flex-col items-center justify-center w-full h-full ${isActive('/ap/bills') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    <Receipt className="w-[22px] h-[22px] mb-1" />
                    <span className="text-[10px] font-medium leading-none">Bills</span>
                </Link>
                <Link to="/reports" className={`flex flex-col items-center justify-center w-full h-full ${isActive('/reports') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    <BarChart3 className="w-[22px] h-[22px] mb-1" />
                    <span className="text-[10px] font-medium leading-none">Reports</span>
                </Link>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                    <Menu className="w-[22px] h-[22px] mb-1" />
                    <span className="text-[10px] font-medium leading-none">Menu</span>
                </button>
            </nav>
        </div>
    );
}
