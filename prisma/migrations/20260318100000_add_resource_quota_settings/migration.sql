ALTER TABLE "AiSetting"
ADD COLUMN "totalStorageLimitBytes" INTEGER,
ADD COLUMN "defaultTeamStorageLimitBytes" INTEGER,
ADD COLUMN "resourceTeamQuotaRules" JSONB;
