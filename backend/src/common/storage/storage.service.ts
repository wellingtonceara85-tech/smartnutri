import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadObjectParams {
  key: string;
  body: Buffer;
  contentType: string;
}

const DEFAULT_DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * Cliente S3-compatible para o MinIO. Nunca expõe URL pública permanente —
 * toda leitura passa por `getDownloadUrl`, que gera uma URL pré-assinada de
 * curta duração. Só a chave do objeto (`storageKey`) é persistida no banco.
 *
 * Dois clientes internos: `client` fala com o endpoint interno (rede Docker,
 * usado para upload/delete reais); `presignClient` assina URLs usando o
 * endpoint público (o que o navegador do usuário realmente consegue
 * alcançar) — presign é só criptografia local, não faz chamada de rede, mas
 * a URL resultante embute o host do cliente usado para assiná-la.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket =
    process.env.STORAGE_BUCKET ?? 'clinica-nutricao-uploads';
  private readonly client: S3Client;
  private readonly presignClient: S3Client;

  constructor() {
    const region = process.env.STORAGE_REGION ?? 'us-east-1';
    const credentials = {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
    };

    this.client = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT,
      region,
      credentials,
      forcePathStyle: true,
    });

    this.presignClient = new S3Client({
      endpoint:
        process.env.STORAGE_PUBLIC_ENDPOINT ?? process.env.STORAGE_ENDPOINT,
      region,
      credentials,
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Bucket "${this.bucket}" criado.`);
      } catch (error) {
        this.logger.warn(
          `Não foi possível garantir o bucket "${this.bucket}": ${(error as Error).message}`,
        );
      }
    }
  }

  async upload({ key, body, contentType }: UploadObjectParams): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getDownloadUrl(
    key: string,
    expiresInSeconds = DEFAULT_DOWNLOAD_URL_TTL_SECONDS,
  ): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn: expiresInSeconds,
      },
    );
  }
}
