import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

// For migrations, connect to localhost:5433 (Docker mapped port)
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST === 'postgres' ? 'localhost' : process.env.DB_HOST,
  port: process.env.DB_HOST === 'postgres' ? 5433 : parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'secretpassword',
  database: process.env.DB_NAME || 'mixology_hub',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});