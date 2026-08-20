-- Support retry-safe deletion across PostgreSQL and blob storage.
ALTER TYPE "UploadStatus" ADD VALUE 'DELETING';
