import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma, UploadStatus, type FileRecord } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import { normalizeName } from '../common/names/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import {
  SIGNED_VIEW_URL_TTL_SECONDS,
  StorageService,
} from '../storage/storage.service';
import type { ConfirmUploadDto } from './dto/confirm-upload.dto';
import {
  MAX_UPLOAD_BYTES,
  PDF_MIME_TYPE,
  type CreateUploadIntentsDto,
  type UploadFileDescriptorDto,
} from './dto/create-upload-intents.dto';

const PDF_SIGNATURE = Buffer.from('%PDF-');
const MAX_NAME_ATTEMPTS = 100;

export type UploadIntent = {
  clientId: string;
  uploadId: string;
  uploadUrl: string;
  displayName: string;
};

export type FileViewUrl = {
  url: string;
  expiresAt: string;
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AccessPolicyService,
    private readonly storage: StorageService,
  ) {}

  async createUploadIntents(
    ownerId: string,
    dataRoomId: string,
    dto: CreateUploadIntentsDto,
  ): Promise<UploadIntent[]> {
    await this.assertDestination(ownerId, dataRoomId, dto.folderId ?? null);

    if (
      new Set(dto.files.map((file) => file.clientId)).size !== dto.files.length
    ) {
      throw new BadRequestException('Each upload must have a unique clientId.');
    }

    const reservedNames = new Set<string>();
    const intents: UploadIntent[] = [];

    for (const file of dto.files) {
      this.assertPdfDescriptor(file);

      const displayName = await this.findAvailableName(
        dataRoomId,
        dto.folderId ?? null,
        file.name,
        reservedNames,
      );
      const uploadId = randomUUID();
      const storageKey = this.storageKey(dataRoomId, uploadId);
      const uploadUrl = await this.storage.createSignedUploadUrl(storageKey);

      reservedNames.add(normalizeName(displayName).normalizedName);
      intents.push({
        clientId: file.clientId,
        uploadId,
        uploadUrl,
        displayName,
      });
    }

    return intents;
  }

  async confirmUpload(
    ownerId: string,
    dataRoomId: string,
    uploadId: string,
    dto: ConfirmUploadDto,
  ): Promise<FileRecord> {
    await this.assertDestination(ownerId, dataRoomId, dto.folderId ?? null);

    const storageKey = this.storageKey(dataRoomId, uploadId);
    const existing = await this.prisma.fileRecord.findUnique({
      where: { storageKey },
    });

    if (existing) {
      return existing;
    }

    try {
      this.assertPdfDescriptor(dto);

      const info = await this.storage.getObjectInfo(storageKey);
      this.assertStoredMetadata(info, dto.sizeBytes);

      const bytes = await this.storage.downloadObject(storageKey);
      this.assertPdfBytes(bytes, dto.sizeBytes);

      const checksum = createHash('sha256').update(bytes).digest('hex');

      return await this.createReadyRecord(
        dataRoomId,
        dto.folderId ?? null,
        dto.name,
        storageKey,
        bytes.length,
        checksum,
      );
    } catch (error) {
      return this.removeAfterFailure(storageKey, error);
    }
  }

  async cancelUpload(
    ownerId: string,
    dataRoomId: string,
    uploadId: string,
  ): Promise<void> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    const storageKey = this.storageKey(dataRoomId, uploadId);
    const committed = await this.prisma.fileRecord.findUnique({
      where: { storageKey },
      select: { id: true },
    });

    if (!committed) {
      await this.storage.removeObjects([storageKey]);
    }
  }

  async getFile(userId: string, fileId: string): Promise<FileRecord> {
    await this.accessPolicy.assertCanRead(userId, {
      type: 'file',
      id: fileId,
    });

    const file = await this.prisma.fileRecord.findFirst({
      where: {
        id: fileId,
        uploadStatus: UploadStatus.READY,
      },
    });

    if (!file) {
      throw new NotFoundException('Resource is not available.');
    }

    return file;
  }

  async getViewUrl(userId: string, fileId: string): Promise<FileViewUrl> {
    const file = await this.getFile(userId, fileId);

    if (!(await this.storage.objectExists(file.storageKey))) {
      throw new NotFoundException('This PDF is no longer available.');
    }

    return {
      url: await this.storage.createSignedViewUrl(file.storageKey),
      expiresAt: new Date(
        Date.now() + SIGNED_VIEW_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  private async assertDestination(
    ownerId: string,
    dataRoomId: string,
    folderId: string | null,
  ): Promise<void> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    if (!folderId) {
      return;
    }

    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        dataRoomId,
      },
      select: { id: true },
    });

    if (!folder) {
      throw new NotFoundException('Resource is not available.');
    }
  }

  private assertPdfDescriptor(
    file: Pick<UploadFileDescriptorDto, 'name' | 'sizeBytes' | 'mimeType'>,
  ): void {
    const normalized = normalizeName(file.name);

    if (!normalized.name.toLowerCase().endsWith('.pdf')) {
      throw new UnsupportedMediaTypeException('Only PDF files are supported.');
    }

    if (file.mimeType !== PDF_MIME_TYPE) {
      throw new UnsupportedMediaTypeException('Only PDF files are supported.');
    }

    if (file.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `PDF size must not exceed ${MAX_UPLOAD_BYTES} bytes.`,
      );
    }

    if (file.sizeBytes < 1) {
      throw new BadRequestException(
        `PDF size must be between 1 and ${MAX_UPLOAD_BYTES} bytes.`,
      );
    }
  }

  private assertStoredMetadata(
    info: { size: number; contentType: string | null },
    declaredSize: number,
  ): void {
    if (info.size !== declaredSize || info.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        'Uploaded file size does not match the upload request.',
      );
    }

    if (info.contentType !== PDF_MIME_TYPE) {
      throw new UnsupportedMediaTypeException('Uploaded object is not a PDF.');
    }
  }

  private assertPdfBytes(bytes: Buffer, declaredSize: number): void {
    if (bytes.length !== declaredSize || bytes.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        'Uploaded file size does not match the upload request.',
      );
    }

    if (
      bytes.length < PDF_SIGNATURE.length ||
      !bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
    ) {
      throw new UnsupportedMediaTypeException(
        'Uploaded object does not contain a valid PDF signature.',
      );
    }
  }

  private async createReadyRecord(
    dataRoomId: string,
    folderId: string | null,
    requestedName: string,
    storageKey: string,
    sizeBytes: number,
    checksum: string,
  ): Promise<FileRecord> {
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
      const name = await this.findAvailableName(
        dataRoomId,
        folderId,
        requestedName,
      );

      try {
        return await this.prisma.fileRecord.create({
          data: {
            dataRoomId,
            folderId,
            name,
            normalizedName: normalizeName(name).normalizedName,
            storageKey,
            mimeType: PDF_MIME_TYPE,
            sizeBytes: BigInt(sizeBytes),
            checksum,
            uploadStatus: UploadStatus.READY,
          },
        });
      } catch (error) {
        if (!this.isUniqueConflict(error)) {
          throw error;
        }

        const existing = await this.prisma.fileRecord.findUnique({
          where: { storageKey },
        });

        if (existing) {
          return existing;
        }
      }
    }

    throw new BadRequestException('Unable to generate an available file name.');
  }

  private async findAvailableName(
    dataRoomId: string,
    folderId: string | null,
    requestedName: string,
    reservedNames: ReadonlySet<string> = new Set(),
  ): Promise<string> {
    const normalized = normalizeName(requestedName);
    const extensionIndex = normalized.name.toLowerCase().lastIndexOf('.pdf');
    const baseName = normalized.name.slice(0, extensionIndex).trimEnd();

    if (!baseName) {
      throw new BadRequestException(
        'File name must include a name before .pdf.',
      );
    }

    for (let index = 1; index <= MAX_NAME_ATTEMPTS; index += 1) {
      const suffix = index === 1 ? '' : ` (${index})`;
      const maxBaseLength = 120 - suffix.length - 4;
      const candidate = `${baseName.slice(0, maxBaseLength).trimEnd()}${suffix}.pdf`;
      const candidateName = normalizeName(candidate);

      if (reservedNames.has(candidateName.normalizedName)) {
        continue;
      }

      const exists = await this.prisma.fileRecord.findFirst({
        where: {
          dataRoomId,
          folderId,
          normalizedName: candidateName.normalizedName,
        },
        select: { id: true },
      });

      if (!exists) {
        return candidateName.name;
      }
    }

    throw new BadRequestException('Unable to generate an available file name.');
  }

  private async removeAfterFailure(
    storageKey: string,
    originalError: unknown,
  ): Promise<never> {
    try {
      await this.storage.removeObjects([storageKey]);
    } catch {
      // Preserve the validation/database error; cleanup can be retried safely.
    }

    throw originalError;
  }

  private storageKey(dataRoomId: string, uploadId: string): string {
    return `rooms/${dataRoomId}/${uploadId}`;
  }

  private isUniqueConflict(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
