import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Finance transaction bulk-import (.xlsx) can run a few hundred rows —
    // the 1MB default is comfortable for the form fields elsewhere but too
    // tight for an uploaded spreadsheet.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
