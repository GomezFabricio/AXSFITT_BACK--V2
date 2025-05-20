import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 4000;
export const SECRET_KEY = process.env.SECRET_KEY || 'default_secret';
export const DB_HOST = process.env.MYSQL_ADDON_HOST || 'localhost';
export const DB_USER = process.env.MYSQL_ADDON_USER || 'root';
export const DB_PASSWORD = process.env.MYSQL_ADDON_PASSWORD || '';
export const DB_NAME = process.env.MYSQL_ADDON_DB || 'axsfitt';
export const DB_PORT = process.env.MYSQL_ADDON_PORT || 3306;
export const EMAIL_USER = process.env.EMAIL_USER || '';
export const EMAIL_PASS = process.env.EMAIL_PASS || '';