ALTER TABLE "AiSetting"
ADD COLUMN "resourceStorageDriver" TEXT DEFAULT 'local',
ADD COLUMN "resourceS3Endpoint" TEXT,
ADD COLUMN "resourceS3Region" TEXT,
ADD COLUMN "resourceS3Bucket" TEXT,
ADD COLUMN "resourceS3AccessKey" TEXT,
ADD COLUMN "resourceS3SecretKey" TEXT,
ADD COLUMN "resourceS3ForcePathStyle" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "resourceS3UseSsl" BOOLEAN NOT NULL DEFAULT false;
