/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle client-side incompatible modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'react-native-sqlite-storage': false,
        'mysql': false,
        'mysql2': false,
        'oracledb': false,
        'redis': false,
        'sqlite3': false,
        'better-sqlite3': false,
        'pg-native': false,
        '@sap/hana-client': false,
        'hdb-pool': false,
        'mssql': false,
        'typeorm-aurora-data-api-driver': false,
      };
    }

    // Handle TypeORM warnings
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/typeorm/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
        },
      },
    });

    // Ignore critical dependency warnings from TypeORM
    config.ignoreWarnings = [
      {
        module: /typeorm/,
        message: /Critical dependency/,
      },
    ];

    return config;
  },
  serverExternalPackages: ['typeorm', 'pg'], // Moved from experimental
};

export default nextConfig;