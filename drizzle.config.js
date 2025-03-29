/** @type {import("drizzle-kit").Config} */
export default {
    dialect: "postgresql", // Options: "mysql", "sqlite", "postgresql"
    schema: "./utils/schema.js", // Path to your schema file
    dbCredentials: {
        url: 'postgresql://neondb_owner:npg_hlRj6ysvC7KN@ep-proud-cell-a84yif6g-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'
    }
  };
  