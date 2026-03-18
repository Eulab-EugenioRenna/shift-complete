import {
  BucketLocationConstraint,
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, extname, isAbsolute } from 'node:path';
import type { Readable } from 'node:stream';
import { PrismaService } from '../../database/prisma.service';

type StorageDriver = 'local' | 's3';

type ResourceStorageSettings = {
  driver: StorageDriver;
  storagePath: string;
  tempPath: string;
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3ForcePathStyle: boolean;
  s3UseSsl: boolean;
};

type ResourceRecord = {
  name: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
};

@Injectable()
export class ResourceStorageService {
  private s3Client?: S3Client;
  private s3ClientCacheKey?: string;
  private ensuredBucketKey?: string;
  private bucketEnsurePromise?: Promise<void>;

  constructor(private readonly prisma: PrismaService) {}

  async uploadBuffer(file: { originalname: string; buffer: Buffer; mimetype: string }, teamFolder: string): Promise<string> {
    const settings = await this.getSettings();
    const objectPath = this.objectPath(settings.storagePath, teamFolder, file.originalname);

    if (settings.driver === 's3') {
      await this.ensureS3Bucket(settings);
      await this.getS3Client(settings).send(new PutObjectCommand({
        Bucket: settings.s3Bucket,
        Key: objectPath,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      }));
      return objectPath;
    }

    const baseDir = this.localBaseDir(settings.storagePath);
    this.ensureDir(baseDir);
    const finalDir = join(baseDir, teamFolder);
    this.ensureDir(finalDir);
    const finalPath = join(finalDir, this.objectFileName(file.originalname));
    writeFileSync(finalPath, file.buffer);
    return finalPath;
  }

  async uploadTempFile(tempPath: string, originalName: string, mimeType: string, teamFolder: string): Promise<string> {
    const settings = await this.getSettings();
    const objectPath = this.objectPath(settings.storagePath, teamFolder, originalName);

    if (!existsSync(tempPath)) {
      throw new NotFoundException('File temporaneo non trovato');
    }

    if (settings.driver === 's3') {
      await this.ensureS3Bucket(settings);
      await this.getS3Client(settings).send(new PutObjectCommand({
        Bucket: settings.s3Bucket,
        Key: objectPath,
        Body: readFileSync(tempPath),
        ContentType: mimeType || 'application/octet-stream',
      }));
      rmSync(tempPath, { force: true });
      return objectPath;
    }

    const baseDir = this.localBaseDir(settings.storagePath);
    this.ensureDir(baseDir);
    const finalDir = join(baseDir, teamFolder);
    this.ensureDir(finalDir);
    const finalPath = join(finalDir, this.objectFileName(originalName));
    writeFileSync(finalPath, readFileSync(tempPath));
    rmSync(tempPath, { force: true });
    return finalPath;
  }

  async download(resource: ResourceRecord): Promise<
    | { mode: 'local'; path: string; name: string }
    | { mode: 'stream'; body: Readable; name: string; mimeType: string; sizeBytes: number }
  > {
    if (this.isLocalResourcePath(resource.path)) {
      if (!existsSync(resource.path)) {
        throw new NotFoundException('File non disponibile nello storage');
      }
      return { mode: 'local', path: resource.path, name: resource.name };
    }

    const settings = await this.getSettings();
    if (settings.driver !== 's3') {
      throw new NotFoundException('File non disponibile nello storage');
    }

    const result = await this.getS3Client(settings).send(new GetObjectCommand({
      Bucket: settings.s3Bucket,
      Key: resource.path,
    }));

    if (!result.Body || typeof (result.Body as Readable).pipe !== 'function') {
      throw new NotFoundException('File non disponibile nello storage');
    }

    return {
      mode: 'stream',
      body: result.Body as Readable,
      name: resource.name,
      mimeType: resource.mimeType || 'application/octet-stream',
      sizeBytes: resource.sizeBytes,
    };
  }

  async remove(resourcePath: string): Promise<void> {
    if (this.isLocalResourcePath(resourcePath)) {
      rmSync(resourcePath, { force: true });
      return;
    }

    const settings = await this.getSettings();
    if (settings.driver !== 's3') {
      return;
    }

    await this.getS3Client(settings).send(new DeleteObjectCommand({
      Bucket: settings.s3Bucket,
      Key: resourcePath,
    }));
  }

  async tempFilePath(originalName: string): Promise<string> {
    const settings = await this.getSettings();
    const dir = this.localBaseDir(settings.tempPath);
    this.ensureDir(dir);
    return join(dir, this.objectFileName(originalName));
  }

  async teamFolderName(teamId: string | null): Promise<string> {
    if (!teamId) {
      return 'global';
    }

    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
    if (!team) {
      throw new NotFoundException('Team non trovato per la risorsa');
    }

    return `teams/${this.slugify(team.name) || teamId}`;
  }

  async storageMode(): Promise<StorageDriver> {
    const settings = await this.getSettings();
    return settings.driver;
  }

  async storagePath(): Promise<string> {
    const settings = await this.getSettings();
    return settings.storagePath;
  }

  private async getSettings(): Promise<ResourceStorageSettings> {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } }) as any;
    return {
      driver: (settings?.resourceStorageDriver ?? process.env.RESOURCE_STORAGE_DRIVER ?? 'local') as StorageDriver,
      storagePath: process.env.RESOURCE_STORAGE_PATH ?? 'storage/resources',
      tempPath: process.env.RESOURCE_TEMP_PATH ?? 'storage/resources/tmp',
      s3Endpoint: settings?.resourceS3Endpoint ?? process.env.RESOURCE_S3_ENDPOINT ?? undefined,
      s3Region: settings?.resourceS3Region ?? process.env.RESOURCE_S3_REGION ?? 'us-east-1',
      s3Bucket: settings?.resourceS3Bucket ?? process.env.RESOURCE_S3_BUCKET ?? undefined,
      s3AccessKey: settings?.resourceS3AccessKey ?? process.env.RESOURCE_S3_ACCESS_KEY ?? undefined,
      s3SecretKey: settings?.resourceS3SecretKey ?? process.env.RESOURCE_S3_SECRET_KEY ?? undefined,
      s3ForcePathStyle: this.asBoolean(settings?.resourceS3ForcePathStyle, process.env.RESOURCE_S3_FORCE_PATH_STYLE, true),
      s3UseSsl: this.asBoolean(settings?.resourceS3UseSsl, process.env.RESOURCE_S3_USE_SSL, false),
    };
  }

  private localBaseDir(pathValue: string): string {
    return isAbsolute(pathValue) ? pathValue : join(process.cwd(), pathValue);
  }

  private objectPath(basePath: string, teamFolder: string, originalName: string): string {
    const cleanBasePath = basePath.replace(/^\/+|\/+$/g, '');
    const parts = [cleanBasePath, teamFolder, this.objectFileName(originalName)].filter(Boolean);
    return parts.join('/');
  }

  private objectFileName(originalName: string): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(originalName)}`;
  }

  private isLocalResourcePath(resourcePath: string): boolean {
    return isAbsolute(resourcePath) || /^[A-Za-z]:\\/.test(resourcePath);
  }

  private ensureDir(pathValue: string): void {
    if (!existsSync(pathValue)) {
      mkdirSync(pathValue, { recursive: true });
    }
  }

  private getS3Client(settings: ResourceStorageSettings): S3Client {
    const cacheKey = JSON.stringify({
      endpoint: settings.s3Endpoint,
      region: settings.s3Region,
      accessKey: settings.s3AccessKey,
      bucket: settings.s3Bucket,
      forcePathStyle: settings.s3ForcePathStyle,
      useSsl: settings.s3UseSsl,
    });

    if (this.s3Client && this.s3ClientCacheKey === cacheKey) {
      return this.s3Client;
    }

    if (!settings.s3Bucket || !settings.s3Endpoint || !settings.s3AccessKey || !settings.s3SecretKey) {
      throw new NotFoundException('Configurazione S3 incompleta');
    }

    this.s3Client = new S3Client({
      region: settings.s3Region,
      endpoint: settings.s3Endpoint,
      forcePathStyle: settings.s3ForcePathStyle,
      credentials: {
        accessKeyId: settings.s3AccessKey,
        secretAccessKey: settings.s3SecretKey,
      },
    });
    this.s3ClientCacheKey = cacheKey;
    return this.s3Client;
  }

  private async ensureS3Bucket(settings: ResourceStorageSettings): Promise<void> {
    const ensureKey = `${settings.s3Endpoint}:${settings.s3Bucket}`;
    if (this.ensuredBucketKey === ensureKey) {
      return;
    }

    if (!this.bucketEnsurePromise) {
      this.bucketEnsurePromise = (async () => {
        const client = this.getS3Client(settings);
        try {
          await client.send(new HeadBucketCommand({ Bucket: settings.s3Bucket }));
        } catch {
          await client.send(new CreateBucketCommand({
            Bucket: settings.s3Bucket,
            ...(settings.s3Region && settings.s3Region !== 'us-east-1'
              ? { CreateBucketConfiguration: { LocationConstraint: settings.s3Region as BucketLocationConstraint } }
              : {}),
          }));
        }
        this.ensuredBucketKey = ensureKey;
      })().finally(() => {
        this.bucketEnsurePromise = undefined;
      });
    }

    await this.bucketEnsurePromise;
  }

  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private asBoolean(value: boolean | null | undefined, envValue: string | undefined, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (envValue === undefined) {
      return fallback;
    }
    return envValue === 'true';
  }
}
