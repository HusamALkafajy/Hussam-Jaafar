import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  user: process.env.DATABASE_USER || 'studyai',
  password: process.env.DATABASE_PASSWORD || 'studyai_dev_password',
  name: process.env.DATABASE_NAME || 'studyai',
  url: process.env.DATABASE_URL || 'postgresql://studyai:studyai_dev_password@localhost:5432/studyai',
}));
