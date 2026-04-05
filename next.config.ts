import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Official Next.js 15 recommendation for native WASM modules
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  
  webpack: (config, { isServer }) => {
    // 1. On the client-side, alias native modules to false to prevent bundling errors
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
        "@huggingface/transformers": false,
      };
    }
    
    // 2. Add wasm support if needed (Transformers.js v3+)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

export default nextConfig;
