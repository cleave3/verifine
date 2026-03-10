import api from "../lib/axios";

export const fixedAssetService = {
    getAssets: async () => {
        const response = await api.get("/fixed-assets");
        return response.data;
    },

    getAsset: async (id: number) => {
        const response = await api.get(`/fixed-assets/${id}`);
        return response.data;
    },

    createAsset: async (payload: any) => {
        const response = await api.post("/fixed-assets", payload);
        return response.data;
    },

    disposeAsset: async (id: number) => {
        const response = await api.post(`/fixed-assets/${id}/dispose`);
        return response.data;
    },

    runDepreciation: async (payload: { target_date: string; period_id: number }) => {
        const response = await api.post("/fixed-assets/depreciate", payload);
        return response.data;
    }
};
