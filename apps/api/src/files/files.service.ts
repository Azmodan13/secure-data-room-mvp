import {
  BadRequestException,
  ConflictException,
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
import type { MoveFileDto } from './dto/move-file.dto';
import type { RenameFileDto } from './dto/rename-file.dto';
import type { BulkMoveFilesDto } from './dto/bulk-move-files.dto';
import type { BulkDeleteFilesDto } from './dto/bulk-delete-files.dto';

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

  async getPublicViewUrl(
    tokenHash: string,
    fileId: string,
  ): Promise<FileViewUrl> {
    await this.accessPolicy.assertCanReadPublic(tokenHash, {
      type: 'file',
      id: fileId,
    });
    const file = await this.getReadyFile(fileId);

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

  async rename(
    ownerId: string,
    fileId: string,
    dto: RenameFileDto,
  ): Promise<FileRecord> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'file',
      id: fileId,
    });

    const file = await this.getReadyFile(fileId);
    this.assertPdfDescriptor({
      name: dto.name,
      sizeBytes: Number(file.sizeBytes),
      mimeType: file.mimeType,
    });
    const name = normalizeName(dto.name);

    try {
      return await this.prisma.fileRecord.update({
        where: { id: file.id },
        data: {
          name: name.name,
          normalizedName: name.normalizedName,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return this.throwNameConflict(file, file.folderId, name.name);
      }

      throw error;
    }
  }

  async move(
    ownerId: string,
    fileId: string,
    dto: MoveFileDto,
  ): Promise<FileRecord> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'file',
      id: fileId,
    });

    const file = await this.getReadyFile(fileId);
    const folderId = dto.folderId ?? null;

    if (folderId) {
      const destination = await this.prisma.folder.findFirst({
        where: { id: folderId, dataRoomId: file.dataRoomId },
        select: { id: true },
      });

      if (!destination) {
        throw new NotFoundException('Resource is not available.');
      }
    }

    if (folderId === file.folderId) {
      return file;
    }

    const requestedName = dto.name ?? file.name;
    this.assertPdfDescriptor({
      name: requestedName,
      sizeBytes: Number(file.sizeBytes),
      mimeType: file.mimeType,
    });
    const name = normalizeName(requestedName);

    try {
      return await this.prisma.fileRecord.update({
        where: { id: file.id },
        data: {
          folderId,
          name: name.name,
          normalizedName: name.normalizedName,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return this.throwNameConflict(file, folderId, name.name);
      }

      throw error;
    }
  }

  async delete(ownerId: string, fileId: string): Promise<void> {
    const existing = await this.prisma.fileRecord.findUnique({
      where: { id: fileId },
    });

    if (!existing) {
      return;
    }

    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'file',
      id: fileId,
    });

    if (existing.uploadStatus !== UploadStatus.DELETING) {
      const marked = await this.prisma.fileRecord.updateMany({
        where: { id: fileId, uploadStatus: UploadStatus.READY },
        data: { uploadStatus: UploadStatus.DELETING },
      });

      if (marked.count === 0) {
        throw new NotFoundException('Resource is not available.');
      }
    }

    await this.storage.removeObjects([existing.storageKey]);
    await this.prisma.fileRecord.deleteMany({
      where: { id: fileId, uploadStatus: UploadStatus.DELETING },
    });
  }

  async bulkMove(
    ownerId: string,
    dto: BulkMoveFilesDto,
  ): Promise<FileRecord[]> {
    const fileIds = dto.files.map((file) => file.id);

    if (new Set(fileIds).size !== fileIds.length) {
      throw new BadRequestException('Each file may be moved only once.');
    }

    const files = await this.prisma.fileRecord.findMany({
      where: { id: { in: fileIds }, uploadStatus: UploadStatus.READY },
    });

    if (files.length !== fileIds.length) {
      throw new NotFoundException('Resource is not available.');
    }

    await Promise.all(
      files.map((file) =>
        this.accessPolicy.assertCanMutate(ownerId, {
          type: 'file',
          id: file.id,
        }),
      ),
    );

    const dataRoomIds = new Set(files.map((file) => file.dataRoomId));

    if (dataRoomIds.size !== 1) {
      throw new BadRequestException('Files must belong to the same Data Room.');
    }

    const dataRoomId = files[0].dataRoomId;
    const folderId = dto.folderId ?? null;

    if (folderId) {
      const destination = await this.prisma.folder.findFirst({
        where: { id: folderId, dataRoomId },
        select: { id: true },
      });

      if (!destination) {
        throw new NotFoundException('Resource is not available.');
      }
    }

    const requestedById = new Map(dto.files.map((file) => [file.id, file]));
    const existingNames = await this.prisma.fileRecord.findMany({
      where: {
        dataRoomId,
        folderId,
        id: { notIn: fileIds },
      },
      select: { normalizedName: true },
    });
    const reservedNames = new Set(
      existingNames.map((file) => file.normalizedName),
    );
    const updates: Array<{
      file: FileRecord;
      name: string;
      normalizedName: string;
    }> = [];
    const conflicts: Array<{
      fileId: string;
      currentName: string;
      suggestedName: string;
    }> = [];

    for (const file of files) {
      const requestedName = requestedById.get(file.id)?.name ?? file.name;
      this.assertPdfDescriptor({
        name: requestedName,
        sizeBytes: Number(file.sizeBytes),
        mimeType: file.mimeType,
      });
      const name = normalizeName(requestedName);

      if (reservedNames.has(name.normalizedName)) {
        const suggestedName = this.availableNameFromSet(
          name.name,
          reservedNames,
        );
        reservedNames.add(normalizeName(suggestedName).normalizedName);
        conflicts.push({
          fileId: file.id,
          currentName: file.name,
          suggestedName,
        });
      } else {
        reservedNames.add(name.normalizedName);
      }

      updates.push({
        file,
        name: name.name,
        normalizedName: name.normalizedName,
      });
    }

    if (conflicts.length > 0) {
      throw new ConflictException({
        error: {
          code: 'BULK_NAME_CONFLICT',
          message: 'One or more file names are already in use.',
          details: { conflicts },
        },
      });
    }

    try {
      return await this.prisma.$transaction(
        updates.map(({ file, name, normalizedName }) =>
          this.prisma.fileRecord.update({
            where: { id: file.id },
            data: { folderId, name, normalizedName },
          }),
        ),
      );
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException({
          error: {
            code: 'BULK_NAME_CONFLICT',
            message: 'A destination name changed. Review and try again.',
          },
        });
      }

      throw error;
    }
  }

  async bulkDelete(ownerId: string, dto: BulkDeleteFilesDto): Promise<void> {
    const files = await this.prisma.fileRecord.findMany({
      where: {
        id: { in: dto.fileIds },
        uploadStatus: { in: [UploadStatus.READY, UploadStatus.DELETING] },
      },
    });

    if (files.length === 0) {
      return;
    }

    await Promise.all(
      files.map((file) =>
        this.accessPolicy.assertCanMutate(ownerId, {
          type: 'file',
          id: file.id,
        }),
      ),
    );

    await this.prisma.fileRecord.updateMany({
      where: {
        id: { in: files.map((file) => file.id) },
        uploadStatus: UploadStatus.READY,
      },
      data: { uploadStatus: UploadStatus.DELETING },
    });
    await this.storage.removeObjects(files.map((file) => file.storageKey));
    await this.prisma.fileRecord.deleteMany({
      where: {
        id: { in: files.map((file) => file.id) },
        uploadStatus: UploadStatus.DELETING,
      },
    });
  }

  private async getReadyFile(fileId: string): Promise<FileRecord> {
    const file = await this.prisma.fileRecord.findFirst({
      where: { id: fileId, uploadStatus: UploadStatus.READY },
    });

    if (!file) {
      throw new NotFoundException('Resource is not available.');
    }

    return file;
  }

  private async throwNameConflict(
    file: FileRecord,
    folderId: string | null,
    requestedName: string,
  ): Promise<never> {
    const suggestedName = await this.findAvailableName(
      file.dataRoomId,
      folderId,
      requestedName,
      new Set(),
      file.id,
    );

    throw new ConflictException({
      error: {
        code: 'NAME_CONFLICT',
        message: 'A file with this name already exists.',
        details: { suggestedName },
      },
    });
  }

  private availableNameFromSet(
    requestedName: string,
    reservedNames: ReadonlySet<string>,
  ): string {
    const extensionIndex = requestedName.toLowerCase().lastIndexOf('.pdf');
    const baseName = requestedName.slice(0, extensionIndex).trimEnd();

    for (let index = 2; index <= MAX_NAME_ATTEMPTS; index += 1) {
      const suffix = ` (${index})`;
      const maxBaseLength = 120 - suffix.length - 4;
      const candidate = normalizeName(
        `${baseName.slice(0, maxBaseLength).trimEnd()}${suffix}.pdf`,
      );

      if (!reservedNames.has(candidate.normalizedName)) {
        return candidate.name;
      }
    }

    throw new ConflictException({
      error: {
        code: 'BULK_NAME_CONFLICT',
        message: 'Unable to generate an available file name.',
      },
    });
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
    excludeFileId?: string,
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
          ...(excludeFileId ? { id: { not: excludeFileId } } : {}),
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
