import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET;

    return {
        plugins: [react()],
        server: apiProxyTarget
            ? {
                proxy: {
                    '/api': apiProxyTarget
                }
            }
            : undefined
    };
});
