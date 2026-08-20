import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DELETE_BATCH_SIZE = 100;

type StorageDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

@Injectable()
export class StorageService {
  private readonly client: SupabaseClient<StorageDatabase>;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const secretKey = config.getOrThrow<string>('SUPABASE_SECRET_KEY');

    this.bucket = config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');

    this.client = createClient<StorageDatabase>(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async createSignedUploadUrl(storageKey: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(storageKey, { upsert: false });

    if (error) {
      throw new ServiceUnavailableException(
        'Unable to authorize the file upload.',
      );
    }

    return data.signedUrl;
  }

  async getObjectInfo(storageKey: string): Promise<{
    size: number;
    contentType: string | null;
  }> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .info(storageKey);

    if (error) {
      throw new ServiceUnavailableException(
        'Unable to inspect the uploaded file.',
      );
    }

    return {
      size: data.size ?? 0,
      contentType: data.contentType ?? null,
    };
  }

  async downloadObject(storageKey: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(storageKey);

    if (error) {
      throw new ServiceUnavailableException(
        'Unable to verify the uploaded file.',
      );
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async removeObjects(storageKeys: string[]): Promise<void> {
    const uniqueKeys = [
      ...new Set(storageKeys.filter((key) => key.length > 0)),
    ];

    for (
      let offset = 0;
      offset < uniqueKeys.length;
      offset += DELETE_BATCH_SIZE
    ) {
      const batch = uniqueKeys.slice(offset, offset + DELETE_BATCH_SIZE);

      const { error } = await this.client.storage
        .from(this.bucket)
        .remove(batch);

      if (error) {
        throw new ServiceUnavailableException('Unable to delete stored files.');
      }
    }
  }
}
