import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { trackingService } from '../services/trackingService';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { RoleGuard } from '../components/RoleGuard';

interface TrackingOption {
    id: number;
    name: string;
    is_active: boolean;
}

interface TrackingCategory {
    id: number;
    name: string;
    description: string;
    is_active: boolean;
    options: TrackingOption[];
}

const optionSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Option name is required'),
    is_active: z.boolean().default(true),
});

const categorySchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Category name is required'),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
    options: z.array(optionSchema).min(1, 'At least one option is required'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function TrackingCategories() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<TrackingCategory | null>(null);
    const queryClient = useQueryClient();

    const { data: categories = [], isLoading } = useQuery<TrackingCategory[]>({
        queryKey: ['trackingCategories'],
        queryFn: async () => {
            const res = await trackingService.getCategories();
            return res.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: CategoryFormData) => {
            const res = await trackingService.createCategory(data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trackingCategories'] });
            toast.success('Tracking category created successfully');
            closeModal();
        },
        onError: (error: any) => {
            toast.error(
                error.response?.data?.detail || 'Failed to create tracking category'
            );
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: CategoryFormData & { id: number }) => {
            const res = await trackingService.updateCategory(data.id, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trackingCategories'] });
            toast.success('Tracking category updated successfully');
            closeModal();
        },
        onError: (error: any) => {
            toast.error(
                error.response?.data?.detail || 'Failed to update tracking category'
            );
        },
    });

    const form = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema as any),
        defaultValues: {
            name: '',
            description: '',
            is_active: true,
            options: [{ name: '', is_active: true }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'options',
    });

    const onSubmit = (data: CategoryFormData) => {
        if (editingCategory) {
            updateMutation.mutate({ ...data, id: editingCategory.id });
        } else {
            createMutation.mutate(data);
        }
    };

    const openNewModal = () => {
        setEditingCategory(null);
        form.reset({
            name: '',
            description: '',
            is_active: true,
            options: [{ name: '', is_active: true }],
        });
        setIsModalOpen(true);
    };

    const openEditModal = (category: TrackingCategory) => {
        setEditingCategory(category);
        form.reset({
            name: category.name,
            description: category.description || '',
            is_active: category.is_active,
            options: category.options.length > 0 ? category.options.map(opt => ({
                id: opt.id,
                name: opt.name,
                is_active: opt.is_active
            })) : [{ name: '', is_active: true }],
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
    };

    console.log({ categories })

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Tracking Categories
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Manage multi-dimensional reporting tags for transactions.
                    </p>
                </div>
                <RoleGuard allowedRoles={['admin', 'controller']}>
                    <button
                        onClick={openNewModal}
                        className="bg-indigo-600 flex items-center text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition"
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Category
                    </button>
                </RoleGuard>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading tracking categories...</div>
            ) : (
                <div className="grid gap-6">
                    {categories?.map?.((category) => (
                        <div key={category.id} className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="h-5 w-5 text-slate-500" />
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            {category.name}
                                        </h3>
                                        {!category.is_active && (
                                            <span className="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    {category.description && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {category.description}
                                        </p>
                                    )}
                                </div>
                                <RoleGuard allowedRoles={['admin', 'controller']}>
                                    <button
                                        onClick={() => openEditModal(category)}
                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
                                    >
                                        Edit
                                    </button>
                                </RoleGuard>
                            </div>
                            <div className="p-0">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Option Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                        {category?.options?.map?.((option) => (
                                            <tr key={option.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-white">
                                                    {option.name}
                                                </td>
                                                <td className="px-6 py-3 text-sm">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase
                                                        ${option.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                                        {option.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {category?.options?.length === 0 && (
                                            <tr>
                                                <td colSpan={2} className="px-6 py-4 text-center text-sm text-slate-500">
                                                    No tracking options found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}

                    {categories.length === 0 && (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 flex flex-col items-center justify-center text-center">
                            <Settings2 className="h-12 w-12 mb-4 text-slate-300 dark:text-slate-600" />
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                                No tracking categories defined
                            </h3>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">
                                Create categories to track income and expenses across different dimensions.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl my-8">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingCategory ? 'Edit Tracking Category' : 'New Tracking Category'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {editingCategory
                                    ? 'Update category details and options.'
                                    : 'Create a new category (e.g., Department, Location) and its available options.'}
                            </p>
                        </div>

                        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category Name</label>
                                    <input
                                        {...form.register('name')}
                                        placeholder="e.g., Department"
                                        className="mt-1 w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {form.formState.errors.name && (
                                        <p className="text-rose-500 text-xs mt-1">
                                            {form.formState.errors.name.message}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description (Optional)</label>
                                    <input
                                        {...form.register('description')}
                                        placeholder="Track performance by operational department"
                                        className="mt-1 w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        {...form.register('is_active')}
                                        className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                                    />
                                    <label htmlFor="is_active" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                                        Category is active
                                    </label>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg space-y-4 border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Tracking Options</h3>
                                    <button
                                        type="button"
                                        onClick={() => append({ name: '', is_active: true })}
                                        className="flex items-center text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Add Option
                                    </button>
                                </div>

                                {fields?.map?.((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-start">
                                        <div className="flex-1">
                                            <input
                                                {...form.register(`options.${index}.name`)}
                                                placeholder={`Option ${index + 1} Name (e.g., Sales)`}
                                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-sm"
                                            />
                                            {form.formState.errors.options?.[index]?.name && (
                                                <p className="text-xs text-rose-500 mt-1">
                                                    {form.formState.errors.options[index]?.name?.message}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            disabled={fields.length === 1}
                                            className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {form.formState.errors.options && !Array.isArray(form.formState.errors.options) && (
                                    <p className="text-sm text-rose-500">
                                        {form.formState.errors.options.message}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
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
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-70"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : (editingCategory ? 'Save Changes' : 'Create Category')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
