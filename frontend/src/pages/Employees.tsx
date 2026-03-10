import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { payrollService } from "../services/payrollService";
import { RoleGuard } from "../components/RoleGuard";
import { Users as UsersIcon, Plus, Edit2 } from "lucide-react";
import { useCurrencyStore } from "../store/currencyStore";

const employeeSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    department_option_id: z.coerce.number().optional().or(z.literal("")),
    base_salary: z.coerce.number().min(0).default(0),
    hire_date: z.string().optional().or(z.literal("")),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function Employees() {
    const { formatCurrency } = useCurrencyStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const { data: qRes, isLoading } = useQuery({
        queryKey: ["employees"],
        queryFn: payrollService.getEmployees,
    });

    const items = qRes?.data || [];

    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(employeeSchema),
        defaultValues: {
            first_name: "",
            last_name: "",
            email: "",
            department_option_id: "",
            base_salary: 0,
            hire_date: "",
        },
    });

    const createMutation = useMutation({
        mutationFn: payrollService.createEmployee,
        onSuccess: () => {
            toast.success("Employee added successfully");
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            closeModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to add employee");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: any }) => payrollService.updateEmployee(id, payload),
        onSuccess: () => {
            toast.success("Employee updated successfully");
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            closeModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to update employee");
        },
    });

    const onSubmit = (data: EmployeeFormValues) => {
        const payload = {
            ...data,
            department_option_id: data.department_option_id ? Number(data.department_option_id) : null,
            hire_date: data.hire_date || null,
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const openCreateModal = () => {
        setEditingId(null);
        form.reset({
            first_name: "",
            last_name: "",
            email: "",
            department_option_id: "",
            base_salary: 0,
            hire_date: "",
        });
        setIsModalOpen(true);
    };

    const openEditModal = (employee: any) => {
        setEditingId(employee.id);
        form.reset({
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            department_option_id: employee.department_option_id || "",
            base_salary: employee.base_salary,
            hire_date: employee.hire_date || "",
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        form.reset();
    };

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center justify-between mb-8">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <UsersIcon className="w-6 h-6 mr-2 text-indigo-500" />
                        Employees
                    </h1>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
                        Manage your company's workforce and set up payroll details.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <RoleGuard allowedRoles={["admin", "controller", "clerk"]}>
                        <button
                            onClick={openCreateModal}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Employee
                        </button>
                    </RoleGuard>
                </div>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading employees...</div>
            ) : items.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-lg mb-8 p-8 flex items-center justify-center flex-col min-h-[400px]">
                    <UsersIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No employees yet</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
                        Get started by adding your first employee to set up their payroll information.
                    </p>
                    <RoleGuard allowedRoles={["admin", "controller", "clerk"]}>
                        <button
                            onClick={openCreateModal}
                            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            New Employee
                        </button>
                    </RoleGuard>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Base Salary</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {items.map((emp: any) => (
                                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                        {emp.first_name} {emp.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {emp.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {formatCurrency(emp.base_salary)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            {emp.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <RoleGuard allowedRoles={["admin", "controller", "clerk"]}>
                                            <button
                                                onClick={() => openEditModal(emp)}
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </RoleGuard>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">
                            {editingId ? "Edit Employee" : "Add Employee"}
                        </h2>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">First Name <span className="text-red-500">*</span></label>
                                    <input
                                        {...form.register("first_name")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {form.formState.errors.first_name && (
                                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.first_name.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Last Name <span className="text-red-500">*</span></label>
                                    <input
                                        {...form.register("last_name")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {form.formState.errors.last_name && (
                                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.last_name.message}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    {...form.register("email")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                />
                                {form.formState.errors.email && (
                                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Base Salary</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...form.register("base_salary")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hire Date</label>
                                    <input
                                        type="date"
                                        {...form.register("hire_date")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                                >
                                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
