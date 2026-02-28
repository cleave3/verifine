import { create } from 'zustand';
import axios from '../lib/axios';

interface CurrencyState {
    baseCurrency: string;
    activeRates: Record<string, number>;
    fetchSettingsAndRates: () => Promise<void>;
    convertAmount: (amount: number, fromCurrency: string) => number;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
    baseCurrency: 'NGN',
    activeRates: {
        'NGN': 1.0,
        'USD': 1550.0,
        'EUR': 1700.0,
        'GBP': 1950.0
    },
    fetchSettingsAndRates: async () => {
        try {
            // In a real app we would fetch active rates from a service here.
            // For now we get the base currency from settings
            const response = await axios.get('/settings');
            if (response.data && response.data.data) {
                const baseCurrencyCode = response.data.data.base_currency_code;
                set({ baseCurrency: baseCurrencyCode });

                // Fetch dynamic rates for the base currency
                try {
                    const ratesResponse = await axios.get(`/settings/exchange-rates/${baseCurrencyCode}`);
                    if (ratesResponse.data && ratesResponse.data.data && ratesResponse.data.data.rates) {
                        set({ activeRates: ratesResponse.data.data.rates });
                    }
                } catch (rateError) {
                    console.error('Failed to fetch active exchange rates:', rateError);
                }
            }
        } catch (error) {
            console.error('Failed to fetch currency settings:', error);
        }
    },
    convertAmount: (amount: number, fromCurrency: string) => {
        const state = get();
        // In this simple model we assume rate is to NGN (or baseCurrency).
        // Multiply by the active rate map
        const rate = state.activeRates[fromCurrency] || 1.0;
        return amount * rate;
    }
}));
